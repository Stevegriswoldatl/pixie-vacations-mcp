// ============================================================
// HTTP HELPER — one place for every outbound fetch
// ============================================================
// sandals.com / beaches.com sit behind Akamai and return 403 "Access Denied" to default clients,
// so every request carries browser-like headers. Each URL is fetched at most once per cache window;
// concurrent callers share the in-flight request. A failed fetch never throws — callers get null
// (or the last good copy, flagged stale, when they ask for it) and fall through to the next source.
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};
const TIMEOUT_MS = 10_000;
export const HOUR = 60 * 60 * 1000;
const FAIL_BACKOFF_MS = 30 * 60 * 1000; // after a 403/timeout, leave that source alone for 30 min

let fetchImpl = (...a) => globalThis.fetch(...a);
const fresh = new Map();    // url -> { text, fetchedAt, expires }
const lastGood = new Map(); // url -> { text, fetchedAt } (kept forever for stale fallback)
const failedUntil = new Map(); // url -> timestamp
const inflight = new Map(); // url -> Promise

// Tests swap in a fixture-backed fetch; clearPageCache() resets state between tests.
export const setFetchImpl = (fn) => { fetchImpl = fn; };
export const clearPageCache = () => { fresh.clear(); lastGood.clear(); failedUntil.clear(); inflight.clear(); };

const log = (...a) => console.error("[pixie-mcp]", ...a);

async function load(url, ttlMs) {
  if ((failedUntil.get(url) || 0) > Date.now()) return null;
  try {
    const res = await fetchImpl(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const page = { text, fetchedAt: new Date().toISOString() };
    fresh.set(url, { ...page, expires: Date.now() + ttlMs });
    lastGood.set(url, page);
    failedUntil.delete(url);
    return page;
  } catch (e) {
    log(`fetch ${url} failed: ${e.message}`);
    failedUntil.set(url, Date.now() + FAIL_BACKOFF_MS);
    return null;
  }
}

// Returns { text, fetchedAt, stale } or null.
// stale:false — fetched within the TTL. With allowStale, a failed refresh returns the last good copy as stale:true.
export async function fetchPage(url, { ttlMs = 6 * HOUR, allowStale = false } = {}) {
  const hit = fresh.get(url);
  if (hit && hit.expires > Date.now()) return { text: hit.text, fetchedAt: hit.fetchedAt, stale: false };
  if (!inflight.has(url)) inflight.set(url, load(url, ttlMs).finally(() => inflight.delete(url)));
  const page = await inflight.get(url);
  if (page) return { ...page, stale: false };
  if (allowStale && lastGood.has(url)) return { ...lastGood.get(url), stale: true };
  return null;
}

// Stale-only lookup, used after every live source in a fallback chain has failed.
export const stalePage = (url) => (lastGood.has(url) ? { ...lastGood.get(url), stale: true } : null);
