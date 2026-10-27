// ============================================================
// PARSERS — pure functions: page HTML in, plain data out
// ============================================================
// Every parser returns null / [] instead of throwing when a page changes shape,
// so the caller can fall through to the next source.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_RE = `${MONTH_RE}\\.?\\s+\\d{1,2},?\\s*\\d{4}`;
const DASH = "\\s*[–—-]\\s*";

// "November 2, 2026" / "Nov 2,2026" / "Sept 30, 2027" -> "2026-11-02"
export function toISODate(s) {
  const m = String(s || "").match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[1].toLowerCase()] || MONTHS[m[1].toLowerCase().slice(0, 3)];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
const money = (s) => (s == null ? null : Number(String(s).replace(/[^0-9.]/g, "")) || null);

// sandals.com / beaches.com are Next.js apps: much of the copy (offer terms included) lives in an
// escaped RSC payload. Unwrap a few levels of escaping so the text can be searched like normal HTML.
export function decodePayload(t) {
  let s = String(t || "");
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\\\/g, "\\").replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return s;
}
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", hellip: "…", reg: "®", trade: "™" };
export const decodeEntities = (s) => String(s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
// HTML -> one trimmed line per block of text. keepScripts: the brand sites keep offer terms inside <script> payloads.
export const toText = (html, { keepScripts = false } = {}) => decodeEntities(String(html || "")
  .replace(keepScripts ? /<style[^>]*>[\s\S]*?<\/style>/gi : /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, "\n"))
  .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const meta = (html, name) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]).trim() : null;
};

// ---- Brand sale page: https://www.sandals.com/sale/ , https://www.beaches.com/sale/ ----
export function parseBrandSale(html) {
  if (!html) return null;
  const titleM = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleM ? decodeEntities(titleM[1]).trim() : "";
  const desc = meta(html, "description") || meta(html, "og:description") || "";
  const [namePart, ...rest] = title.split(":");
  const saleName = namePart.replace(/^\s*(Sandals|Beaches)\s*(®|\(R\))?\s*/i, "").trim();
  const text = toText(decodePayload(html), { keepScripts: true });
  const bookM = text.match(new RegExp(`Booking Window:\\s*(?:Now|${DATE_RE})${DASH}(${DATE_RE})`, "i"));
  const travelM = text.match(new RegExp(`(?:Instant Credit )?Travel Window:\\s*(?:Now|${DATE_RE})${DASH}(${DATE_RE})`, "i"));
  const blurb = `${title} ${desc}`;
  const pct = blurb.match(/up to (\d{1,2})%\s*off/i);
  const instant = blurb.match(/up to \$([\d,]+)(?: in)?\s+(?:instant |resort )?credit/i);
  const air = blurb.match(/up to \$([\d,]+)(?: in)?\s+air credit/i);
  return {
    sale_name: /\b(sale|event|offer|deal|savings|days)\b/i.test(saleName) ? saleName : null,
    headline: rest.join(":").trim() || null,
    savings_percent: pct ? Number(pct[1]) : null,
    instant_credit: instant ? money(instant[1]) : null,
    air_credit: air ? money(air[1]) : null,
    book_by: bookM ? toISODate(bookM[1]) : null,
    travel_through: travelM ? toISODate(travelM[1]) : null,
    summary: desc || null,
  };
}

// ---- Pixie's own deal page: https://pixievacations.com/sandals-beaches-deals/ ----
// Lines look like: "sandals · Jamaica" / "Sandals Ochi" / "The Great Jamaica Comeback Sale · up to $1,500"
// plus one "Book by Nov 2, 2026 to lock this offer in." line.
export function parsePixieDeals(html) {
  if (!html) return null;
  const text = toText(html);
  const bookM = text.match(new RegExp(`Book by (${DATE_RE})`, "i"));
  const book_by = bookM ? toISODate(bookM[1]) : null;
  const out = {};
  for (const brand of ["sandals", "beaches"]) {
    const m = text.match(new RegExp(`^${brand} · [^\\n]+\\n[^\\n]+\\n([^\\n]+?) · up to \\$([\\d,]+)\\s*$`, "im"));
    out[brand] = m ? { sale_name: m[1].trim(), headline: `Up to $${m[2]} credit`, savings_percent: null, instant_credit: money(m[2]), air_credit: null, book_by, travel_through: null } : null;
  }
  return out;
}

// ---- Pixie's weekly 777 pages: /sandals-777-deals/ , /beaches-777-deals/ ----
export function parse777(html) {
  if (!html) return null;
  const text = toText(html);
  // "Deals Valid October 21 – October 28, 2026"
  const vm = text.match(new RegExp(`Deals Valid (${MONTH_RE})\\.?\\s+(\\d{1,2})${DASH}(${MONTH_RE})\\.?\\s+(\\d{1,2}),?\\s*(\\d{4})`, "i"));
  let valid_from = null, valid_through = null;
  if (vm) {
    valid_through = toISODate(`${vm[3]} ${vm[4]}, ${vm[5]}`);
    const fromMonth = MONTHS[vm[1].toLowerCase().slice(0, 3)], toMonth = MONTHS[vm[3].toLowerCase().slice(0, 3)];
    valid_from = toISODate(`${vm[1]} ${vm[2]}, ${fromMonth > toMonth ? +vm[5] - 1 : vm[5]}`);
  }
  // The "at a glance" table: header names decide the columns, so a reordered table still parses.
  const table = (html.match(/<table[\s\S]*?<\/table>/i) || [""])[0];
  const cells = (row, tag) => [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((c) => toText(c[1]).replace(/\n/g, " "));
  const headers = cells((table.match(/<tr[\s\S]*?<\/tr>/i) || [""])[0], "th").map((h) => h.toLowerCase());
  const col = (re) => headers.findIndex((h) => re.test(h));
  const ci = { resort: col(/resort/), location: col(/location/), suite: col(/room|suite/), code: col(/code/), price: col(/from|price/), child: col(/child/) };
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => cells(r[0], "td")).filter((r) => r.length >= 3);
  // Beaches' table has no code column; the per-room detail cards ("Room Code: XX") are in the same order.
  const detailCodes = [...text.matchAll(/Room Code:\s*([A-Z0-9]{1,6})\b/g)].map((m) => m[1]);
  const rooms = rows.map((r, i) => ({
    resort: r[ci.resort] || null,
    location: ci.location >= 0 ? r[ci.location] : null,
    suite: ci.suite >= 0 ? r[ci.suite] : null,
    room_code: (ci.code >= 0 && r[ci.code]) || (detailCodes.length === rows.length ? detailCodes[i] : null),
    price_per_night: ci.price >= 0 ? money(r[ci.price]) : null,
    child_price_per_night: ci.child >= 0 ? money(r[ci.child]) : null,
  })).filter((x) => x.resort);
  return { valid_from, valid_through, book_by: valid_through, rooms };
}

// ---- Resort data block on beaches.com/resorts/ (covers BOTH brands, keyed by resort code) ----
// e.g. "SRC":"[ \"name:Sandals Jamaica Caribbean Cay\", \"location:Montego Bay, Jamaica\", \"butler:true\", ... ]"
export function parseResortCodes(html) {
  const s = decodePayload(html);
  const out = {};
  for (const m of s.matchAll(/"([A-Z]{3,4})":"\[\s*([\s\S]*?)\s*\]"/g)) {
    const f = Object.fromEntries([...m[2].matchAll(/"([a-zA-Z0-9]+):([^"]*)"/g)].map((x) => [x[1], decodeEntities(x[2]).trim()]));
    if (!f.name || !/^(Sandals|Beaches)\b/.test(f.name) || out[m[1]]) continue;
    out[m[1]] = { code: m[1], name: f.name, location: f.location || null, butler: f.butler ? /^true/i.test(f.butler) : null };
  }
  return out;
}

// ---- Site navigation resort links: {"content":"Sandals Grand Bay","href":"/grand-bay/"} ----
export function parseNavResorts(html) {
  const s = decodePayload(html);
  const seen = new Map();
  for (const m of s.matchAll(/"content":"((?:Sandals|Beaches) [^"]+)","href":"(\/[a-z0-9\-/]*)"/g)) {
    const name = decodeEntities(m[1]).trim();
    if (!seen.has(name)) seen.set(name, { name, path: m[2].endsWith("/") ? m[2] : `${m[2]}/` });
  }
  return [...seen.values()];
}

// ---- "Opening Nov 18, 2026" banners next to a resort heading on the brand sale pages ----
export function parseOpeningBanners(html) {
  const out = [];
  for (const m of String(html || "").matchAll(new RegExp(`(Re-?opening|Opening)\\s*(?:<br\\s*/?>)?\\s*(${DATE_RE})`, "gi"))) {
    const h = html.slice(m.index + m[0].length, m.index + m[0].length + 900).match(/<h3[^>]*>([^<]+)<\/h3>/i);
    if (h) out.push({ resort: decodeEntities(h[1]).trim(), opening_date: toISODate(m[2]) });
  }
  return out;
}
