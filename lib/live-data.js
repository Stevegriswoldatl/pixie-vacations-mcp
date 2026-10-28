// ============================================================
// LIVE SANDALS / BEACHES DATA — computed at call time, never hand-edited
// ============================================================
// Deals, resort names and resort URLs all come from pages that change on their own:
//   deals   -> sandals.com/sale + beaches.com/sale, falling back to pixievacations.com/sandals-beaches-deals/
//   777     -> pixievacations.com/sandals-777-deals/ + /beaches-777-deals/
//   resorts -> beaches.com/resorts/ (resort-code data block, both brands) + site navigation (URL paths)
// The only hand-kept data below is undated: the alias table (old names -> resort code) and
// per-resort traits (best_for, tier, over-water) keyed by resort code, which survives renames.
import { fetchPage, stalePage, HOUR } from "./http.js";
import { parseBrandSale, parsePixieDeals, parse777, parseResortCodes, parseNavResorts, parseOpeningBanners } from "./parsers.js";

export const REFERRAL = "135752";
export const BRAND_BASE = { sandals: "https://www.sandals.com", beaches: "https://www.beaches.com" };
export const SOURCES = {
  sandals_sale: "https://www.sandals.com/sale/",
  beaches_sale: "https://www.beaches.com/sale/",
  pixie_deals: "https://pixievacations.com/sandals-beaches-deals/",
  sandals_777: "https://pixievacations.com/sandals-777-deals/",
  beaches_777: "https://pixievacations.com/beaches-777-deals/",
  resort_codes: "https://www.beaches.com/resorts/",
};
const DEALS_TTL = 6 * HOUR;
const CATALOG_TTL = 24 * HOUR;

// https://www.<brand>.com<path>?referral=135752 — "&" when the path already has a query string.
export function brandUrl(brand, path = "/", params = {}) {
  const base = `${BRAND_BASE[brand]}${path.startsWith("/") ? path : `/${path}`}`;
  const qs = Object.entries({ referral: REFERRAL, ...params }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${base}${base.includes("?") ? "&" : "?"}${qs}`;
}

// Any sandals.com / beaches.com link we show carries the referral; other links pass through untouched.
const publicUrl = (u) => { const m = String(u || "").match(/^https:\/\/www\.(sandals|beaches)\.com(\/.*)$/); return m ? brandUrl(m[1], m[2]) : u; };

// Same normalization the server uses for destinations: "St." ≡ "Saint", "&" ≡ "and", accents and apostrophes ignored.
export const norm = (s) => (" " + String(s || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/&/g, " and ")
  .replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim() + " ")
  .replace(/ st /g, " saint ")
  .trim();
const BRAND_WORDS = new Set(["sandals", "beaches", "resort", "resorts"]);
const tokens = (s) => norm(s).split(" ").filter((t) => t && !BRAND_WORDS.has(t));
const brandOf = (name) => (/^beaches\b/i.test(name) ? "beaches" : "sandals");

// ---- Alias table (version 2026-10-21) ----
// Every name a traveler or an old blog post might use -> Sandals' own resort code.
// Codes don't change when Sandals renames a resort, so the current name always comes from the live site.
// Source: caribbeanmag.com/sandals-resort-name-changes/ (Sandals renamed 15 of 19 resorts on 2026-10-21).
export const ALIASES_VERSION = "2026-10-21";
export const ALIASES = {
  "Sandals Montego Bay": "SMB",
  "Sandals Royal Caribbean": "SRC", "Sandals Royal Caribbean Resort and Private Island": "SRC", "Sandals Caribbean Cay": "SRC",
  "Sandals South Coast": "SWH", "Sandals Whitehouse": "SWH",
  "Sandals Ochi": "SGO", "Sandals Ochi Beach": "SGO", "Sandals Ocho Rios": "SGO",
  "Sandals Negril": "SNG",
  "Sandals Dunn's River": "SDR",
  "Sandals Royal Plantation": "BRP",
  "Beaches Negril": "BNG",
  "Sandals Grande St. Lucian": "SGL", "Sandals Grand Bay": "SGL",
  "Sandals Regency La Toc": "SLU", "Sandals La Toc": "SLU",
  "Sandals Halcyon Beach": "SHC",
  "Sandals Royal Bahamian": "SRB", "Sandals Nassau": "SRB",
  "Sandals Grande Antigua": "SAT",
  "Sandals Royal Curaçao": "SCR",
  "Sandals Saint Vincent and the Grenadines": "SSV", "Sandals Saint Vincent": "SSV",
  "Sandals LaSource Grenada": "SLS",
  "Beaches Turks & Caicos": "BTC",
};
// Closed resorts answer with a clear "closed" result instead of a dead link.
export const CLOSED = {
  BBO: { name: "Beaches Ocho Rios", brand: "beaches", closed: "2025-05-31", note: "Beaches Ocho Rios closed permanently on May 31, 2025. The open Beaches resorts are listed under alternatives." },
};
const CLOSED_ALIASES = { "Beaches Ocho Rios": "BBO", "Beaches Boscobel": "BBO" };

// ---- Per-resort traits (undated; keyed by code) ----
// Over-water bungalows: Caribbean Cay, South Coast, Grand Bay (St. Lucia), Royal Barbados, St. Vincent — not Royal Bahamian.
export const RESORT_TRAITS = {
  SBR: { best_for: ["couples", "honeymoon", "golfers", "luxury", "overwater"], tier: "premium", overwater: true },
  SBD: { best_for: ["couples", "honeymoon", "divers"], tier: "moderate", overwater: false },
  SGL: { best_for: ["honeymoon", "anniversary", "romance", "overwater"], tier: "luxury", overwater: true },
  SHC: { best_for: ["couples", "first-timers", "budget"], tier: "value", overwater: false },
  SLU: { best_for: ["couples", "golfers", "privacy", "villas"], tier: "premium", overwater: false },
  BRP: { best_for: ["luxury", "butler", "honeymoon", "special occasions"], tier: "ultra-luxury", overwater: false },
  SGO: { best_for: ["first-timers", "budget", "entertainment"], tier: "value", overwater: false },
  SDR: { best_for: ["modern", "new experiences", "couples"], tier: "premium", overwater: false },
  SNG: { best_for: ["beach", "sunset", "honeymooners", "relaxation"], tier: "moderate", overwater: false },
  SWH: { best_for: ["overwater", "seclusion", "snorkeling", "privacy"], tier: "luxury", overwater: true },
  SRC: { best_for: ["overwater", "private island", "unique"], tier: "luxury", overwater: true },
  SMB: { best_for: ["first-timers", "convenience", "short stays"], tier: "value", overwater: false },
  SAT: { best_for: ["couples", "honeymoon", "beach", "first-timers"], tier: "premium", overwater: false },
  SRB: { best_for: ["couples", "nassau", "accessibility", "private island"], tier: "moderate", overwater: false },
  SLS: { best_for: ["seclusion", "divers", "couples"], tier: "luxury", overwater: false },
  SCR: { best_for: ["unique destination", "off-beaten-path", "outside hurricane belt"], tier: "premium", overwater: false },
  SSV: { best_for: ["unique", "newest", "adventurous couples", "overwater"], tier: "premium", overwater: true },
  BTC: { best_for: ["families", "kids", "waterpark"], tier: "luxury", waterpark: true },
  BNG: { best_for: ["beach families", "jamaica", "budget", "toddlers"], tier: "moderate", waterpark: true },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// ---- Resort catalog ----
// Joins the resort-code data block (current full names + locations) to each brand's navigation links (URL paths).
// A nav link belongs to a resort when all of its name words appear in the resort's full name; the closest fit wins
// ("Sandals Barbados" -> SBD, not SBR). Resorts with no nav link (e.g. closed ones) get no URL.
export function buildCatalog({ codesHtml, sandalsNavHtml, beachesNavHtml, bannerHtml = [] }) {
  const codes = parseResortCodes(codesHtml);
  if (Object.keys(codes).length < 5) return null;
  const nav = { sandals: parseNavResorts(sandalsNavHtml), beaches: parseNavResorts(beachesNavHtml) };
  const openings = bannerHtml.flatMap(parseOpeningBanners);
  const resorts = Object.values(codes).map((r) => {
    const brand = brandOf(r.name);
    const full = tokens(r.name);
    let best = null;
    for (const n of nav[brand]) {
      const t = tokens(n.name);
      if (!t.length || !t.every((w) => full.includes(w))) continue;
      const extra = full.length - t.length;
      if (!best || extra < best.extra || (extra === best.extra && t.length > best.len)) best = { ...n, extra, len: t.length };
    }
    const location = r.location;
    const entry = {
      code: r.code, brand, name: r.name, short_name: best ? best.name : null,
      location, country: location ? location.split(",").pop().trim() : null,
      path: best ? best.path : null, butler: r.butler,
    };
    const open = openings.find((o) => norm(o.resort) === norm(r.name));
    if (open && open.opening_date > todayISO()) Object.assign(entry, { status: "opening_soon", opening_date: open.opening_date });
    return entry;
  });
  return { resorts };
}

export async function getCatalog() {
  const [codes, sandalsSale, beachesSale] = await Promise.all([
    fetchPage(SOURCES.resort_codes, { ttlMs: CATALOG_TTL, allowStale: true }),
    fetchPage(SOURCES.sandals_sale, { ttlMs: DEALS_TTL, allowStale: true }),
    fetchPage(SOURCES.beaches_sale, { ttlMs: DEALS_TTL, allowStale: true }),
  ]);
  if (!codes || !sandalsSale) return null;
  try {
    const cat = buildCatalog({
      codesHtml: codes.text, sandalsNavHtml: sandalsSale.text, beachesNavHtml: codes.text,
      bannerHtml: [sandalsSale.text, beachesSale?.text].filter(Boolean),
    });
    if (!cat) return null;
    return { ...cat, fetched_at: codes.fetchedAt, stale: codes.stale || sandalsSale.stale };
  } catch (e) {
    console.error("[pixie-mcp] catalog parse failed:", e.message);
    return null;
  }
}

// Old names this resort has gone by (from the alias table), minus its current names.
export const formerNames = (r) => Object.entries(ALIASES)
  .filter(([n, c]) => c === r.code && norm(n) !== norm(r.name) && norm(n) !== norm(r.short_name || ""))
  .map(([n]) => n);

// ---- Fuzzy resolver: alias table first, then current names ----
// Returns { resort } | { closed } | null. brand ("sandals"/"beaches") narrows the search; with no brand,
// a tie goes to Sandals ("Negril" -> Sandals Negril; "Beaches Negril" -> Beaches).
export function resolveResort(catalog, query, brand) {
  const q = norm(query);
  if (!q) return null;
  const qt = tokens(query);
  for (const [n, code] of Object.entries(CLOSED_ALIASES)) if (norm(n) === q) return { closed: { code, ...CLOSED[code] } };
  const list = (catalog?.resorts || []).filter((r) => !brand || r.brand === brand);
  const byCode = Object.fromEntries(list.map((r) => [r.code, r]));
  // 1. exact current name, then exact alias
  for (const r of list) if ([r.name, r.short_name].some((n) => n && norm(n) === q)) return { resort: r, matched: null };
  for (const [n, code] of Object.entries(ALIASES)) if (norm(n) === q && byCode[code]) return { resort: byCode[code], matched: n };
  if (!qt.length) return null;
  // 2. token match across every name a resort has gone by
  const names = [ // current names first: on a tied score the first entry wins
    ...list.flatMap((r) => [r.name, r.short_name].filter(Boolean).map((n) => ({ n, r, alias: false }))),
    ...Object.entries(ALIASES).filter(([, c]) => byCode[c]).map(([n, c]) => ({ n, r: byCode[c], alias: true })),
  ];
  let best = null;
  for (const { n, r, alias } of names) {
    const nt = tokens(n);
    if (!nt.length) continue;
    let score = 0;
    if (qt.every((w) => nt.includes(w))) score = 80 - (nt.length - qt.length);       // "caribbean cay" in "sandals jamaica caribbean cay"
    else if (nt.every((w) => qt.includes(w))) score = 60 - (qt.length - nt.length);  // "sandals negril jamaica resort" contains "negril"
    if (!score) continue;
    if (r.brand === "sandals") score += 0.1;
    if (!best || score > best.score) best = { score, resort: r, matched: alias ? n : null };
  }
  if (best) return { resort: best.resort, matched: best.matched };
  for (const [n, code] of Object.entries(CLOSED_ALIASES)) if (tokens(n).every((w) => qt.includes(w)) && qt.every((w) => tokens(n).includes(w))) return { closed: { code, ...CLOSED[code] } };
  return null;
}

// ---- Deals ----
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);
const usable = (d) => d && d.sale_name && d.book_by;

// Brand page first, then Pixie's own page, then the last good copy of either (flagged stale).
async function brandDeal(brand) {
  const saleUrl = SOURCES[`${brand}_sale`];
  const attempts = [
    async () => { const p = await fetchPage(saleUrl, { ttlMs: DEALS_TTL }); return p && { ...parseBrandSale(p.text), source_url: saleUrl, fetched_at: p.fetchedAt, stale: false }; },
    async () => { const p = await fetchPage(SOURCES.pixie_deals, { ttlMs: DEALS_TTL }); return p && { ...parsePixieDeals(p.text)?.[brand], source_url: SOURCES.pixie_deals, fetched_at: p.fetchedAt, stale: false }; },
    async () => { const p = stalePage(saleUrl); return p && { ...parseBrandSale(p.text), source_url: saleUrl, fetched_at: p.fetchedAt, stale: true }; },
    async () => { const p = stalePage(SOURCES.pixie_deals); return p && { ...parsePixieDeals(p.text)?.[brand], source_url: SOURCES.pixie_deals, fetched_at: p.fetchedAt, stale: true }; },
  ];
  for (const attempt of attempts) {
    try { const d = await attempt(); if (usable(d)) return d; }
    catch (e) { console.error(`[pixie-mcp] ${brand} deal parse failed:`, e.message); }
  }
  return null;
}

// pixievacations.com can be slow; the deals reply waits at most SLOW_SOURCE_MS for a 777 page.
// Past that it uses the last good copy (or says the rooms are still loading) while the fetch
// keeps going in the background and fills the cache for the next call.
const SLOW_SOURCE_MS = 2500;
const TIMED_OUT = Symbol("timed out");
const within = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(r, ms, TIMED_OUT).unref?.())]);

async function weekly777(brand, catalogPromise) {
  const url = SOURCES[`${brand}_777`];
  let p = await within(fetchPage(url, { ttlMs: DEALS_TTL, allowStale: true }), SLOW_SOURCE_MS);
  const loading = p === TIMED_OUT;
  if (loading) p = stalePage(url);
  let d = null;
  try { d = p && parse777(p.text); } catch (e) { console.error(`[pixie-mcp] ${brand} 777 parse failed:`, e.message); }
  if (!d || !d.rooms.length) return {
    source_url: url, available: false, stale: true, fetched_at: p?.fetchedAt || null,
    ...(loading ? { loading: true, message: "This week's rooms are still loading. Ask again in a minute, or see the guide page." } : {}),
  };
  const catalog = await catalogPromise;
  return {
    source_url: url, fetched_at: p.fetchedAt, stale: p.stale || loading,
    valid_from: d.valid_from, valid_through: d.valid_through, book_by: d.book_by,
    rooms: d.rooms.map((x) => {
      const hit = catalog ? resolveResort(catalog, x.resort, brand) : null;
      const r = hit?.resort;
      return {
        resort: r ? r.name : x.resort, location: x.location, suite: x.suite, room_code: x.room_code,
        price_per_night: x.price_per_night, ...(x.child_price_per_night != null ? { child_price_per_night: x.child_price_per_night } : {}),
        price_basis: "per person, per night, before other offers",
        book_url: r?.path ? brandUrl(brand, r.path) : brandUrl(brand, "/specials/suite-deals/"),
      };
    }),
  };
}

const saleDesc = (d) => {
  if (!d) return "Current sale details are on the live offers page.";
  const parts = [d.savings_percent ? `up to ${d.savings_percent}% off` : null,
    d.instant_credit ? `up to $${d.instant_credit.toLocaleString("en-US")} instant credit` : null,
    d.air_credit ? `up to $${d.air_credit.toLocaleString("en-US")} air credit` : null].filter(Boolean);
  return `${d.sale_name}${parts.length ? ` — ${parts.join(" + ")}` : ""}. Book by ${fmtDate(d.book_by)}.${d.travel_through ? ` Instant credit valid for travel through ${fmtDate(d.travel_through)}.` : ""}`;
};

export async function getDeals() {
  const catalog = getCatalog();
  const [sandals, beaches, s777, b777] = await Promise.all([brandDeal("sandals"), brandDeal("beaches"), weekly777("sandals", catalog), weekly777("beaches", catalog)]);
  const brandBlock = (d) => (d ? {
    sale_name: d.sale_name, headline: d.headline, savings_percent: d.savings_percent, instant_credit: d.instant_credit,
    air_credit: d.air_credit, book_by: d.book_by, travel_through: d.travel_through, source_url: publicUrl(d.source_url), fetched_at: d.fetched_at, stale: d.stale,
  } : { available: false, stale: true });
  const fetchedTimes = [sandals, beaches].filter(Boolean).map((d) => d.fetched_at).sort();
  const fetched_at = fetchedTimes[0] || null; // oldest source used
  const stale = !sandals || !beaches || sandals.stale || beaches.stale;
  return {
    source: "Pixie Vacations — Sandals & Beaches Platinum Elite",
    verified: fetched_at ? fetched_at.slice(0, 10) : null,
    fetched_at,
    stale,
    sandals: brandBlock(sandals),
    beaches: brandBlock(beaches),
    promotions: [
      { name: "Sandals — current sale", desc: saleDesc(sandals), url: brandUrl("sandals", "/sale/"), all: brandUrl("sandals", "/specials/"), sale_name: sandals?.sale_name || null, book_by: sandals?.book_by || null },
      { name: "Beaches — current sale", desc: saleDesc(beaches), url: brandUrl("beaches", "/sale/"), all: brandUrl("beaches", "/deals/"), sale_name: beaches?.sale_name || null, book_by: beaches?.book_by || null },
      { name: "Sandals 777 (weekly suite deal)", desc: "Each week, an extra 7% off 7 qualifying rooms and suites on top of current offers. Refreshes every Wednesday.", url: brandUrl("sandals", "/specials/suite-deals/"), guide: SOURCES.sandals_777, this_week: s777 },
      { name: "Beaches 777 (weekly suite deal)", desc: "Each week, an extra 7% off 7 qualifying family rooms and suites. Refreshes every Wednesday.", url: brandUrl("beaches", "/specials/suite-deals/"), guide: SOURCES.beaches_777, this_week: b777 },
    ],
    all_sandals: brandUrl("sandals", "/specials/"),
    all_beaches: brandUrl("beaches", "/deals/"),
    free_quote: "https://pixievacations.com/get-a-quote/",
    note: stale
      ? "Some offer details could not be refreshed just now and may be out of date — confirm on the live offers page. Booking through Pixie Vacations is free: no fees, free planning."
      : "Offer details are read live from sandals.com and beaches.com. Booking through Pixie Vacations is free: no fees, free planning, and a better offer for your room is applied if one comes out before final payment.",
  };
}
