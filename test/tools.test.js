// Tool handlers end to end with fixture-backed fetch: fallback order, caching, stale flag, copy rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { useFixtures, loadServer, fixture, FIXTURE_FOR } from "./helpers.js";
import { SOURCES } from "../lib/live-data.js";
import { setFetchImpl } from "../lib/http.js";

const { tools, TOOL_SCHEMAS } = await loadServer();

test("deals come from the brand sale pages first", async () => {
  useFixtures();
  const d = await tools.get_sandals_beaches_deals();
  assert.equal(d.sandals.source_url, "https://www.sandals.com/sale/?referral=135752");
  assert.equal(d.sandals.sale_name, "The Great Jamaica Comeback Sale");
  assert.equal(d.sandals.book_by, "2026-11-02");
  assert.equal(d.beaches.sale_name, "Winter Escapes Sale");
  assert.equal(d.stale, false);
  assert.match(d.fetched_at, /^\d{4}-\d\d-\d\dT/);
  // existing response shape kept
  for (const k of ["source", "verified", "promotions", "all_sandals", "all_beaches", "free_quote", "note"]) assert.ok(k in d, k);
  assert.equal(d.promotions.length, 4);
  for (const p of d.promotions) for (const k of ["name", "desc", "url"]) assert.ok(p[k], `${p.name}.${k}`);
  assert.equal(d.promotions[2].this_week.rooms.length, 7);
  assert.match(d.promotions[2].this_week.rooms[0].book_url, /^https:\/\/www\.sandals\.com\/.+\?referral=135752$/);
});

test("brand pages 403 -> falls through to pixievacations.com", async () => {
  useFixtures({ blocked: new Set([SOURCES.sandals_sale, SOURCES.beaches_sale]) });
  const d = await tools.get_sandals_beaches_deals();
  assert.equal(d.sandals.source_url, SOURCES.pixie_deals);
  assert.equal(d.sandals.sale_name, "The Great Jamaica Comeback Sale");
  assert.equal(d.sandals.book_by, "2026-11-02");
  assert.equal(d.beaches.source_url, SOURCES.pixie_deals);
  assert.equal(d.stale, false);
});

test("one fetch per source per cache window", async () => {
  const calls = useFixtures();
  await tools.get_sandals_beaches_deals();
  await tools.get_sandals_beaches_deals();
  await tools.search_sandals_resorts({});
  const counts = calls.reduce((m, u) => ({ ...m, [u]: (m[u] || 0) + 1 }), {});
  for (const [u, n] of Object.entries(counts)) assert.equal(n, 1, `${u} fetched ${n}x`);
});

test("every source down after a good fetch -> last result, flagged stale, original fetched_at", async () => {
  useFixtures();
  const first = await tools.get_sandals_beaches_deals();
  // expire the fresh cache by advancing the clock past 24 h, then fail every request
  const realNow = Date.now;
  Date.now = () => realNow() + 25 * 60 * 60 * 1000;
  try {
    setFetchImpl(async () => new Response("Access Denied", { status: 403 }));
    const d = await tools.get_sandals_beaches_deals();
    assert.equal(d.stale, true);
    assert.equal(d.sandals.stale, true);
    assert.equal(d.sandals.sale_name, first.sandals.sale_name);
    assert.equal(d.sandals.fetched_at, first.sandals.fetched_at);
    const r = await tools.get_resort_booking_url({ resort_name: "Sandals Negril" });
    assert.match(r.book_url, /\/negril\/\?referral=135752$/);
  } finally { Date.now = realNow; }
});

test("nothing ever fetched + everything down -> no throw, links still work", async () => {
  useFixtures({ blocked: new Set(Object.values(SOURCES)) });
  const d = await tools.get_sandals_beaches_deals();
  assert.equal(d.stale, true);
  assert.equal(d.sandals.available, false);
  assert.match(d.promotions[0].url, /^https:\/\/www\.sandals\.com\/sale\/\?referral=135752$/);
  const r = await tools.get_resort_booking_url({ resort_name: "Sandals Negril" });
  assert.equal(r.not_found, true);
  assert.match(r.book_url, /^https:\/\/www\.sandals\.com\/\?referral=135752$/);
  const s = await tools.search_sandals_resorts({});
  assert.ok(Array.isArray(s));
});

test("get_resort_booking_url: old name -> current resort URL; closed resort -> closed", async () => {
  useFixtures();
  const r = await tools.get_resort_booking_url({ resort_name: "Sandals Royal Caribbean" });
  assert.equal(r.resort, "Sandals Jamaica Caribbean Cay");
  assert.equal(r.book_url, "https://www.sandals.com/caribbean-cay/?referral=135752");
  assert.equal(r.matched_former_name, "Sandals Royal Caribbean");
  const c = await tools.get_resort_booking_url({ resort_name: "Beaches Ocho Rios" });
  assert.equal(c.closed, true);
  assert.equal(c.book_url, undefined);
  assert.deepEqual(c.alternatives.map((a) => a.name).sort(), ["Beaches Jamaica Negril", "Beaches Turks and Caicos"]);
});

test("over-water list: Caribbean Cay, South Coast, Grand Bay, Royal Barbados, St. Vincent — not Nassau", async () => {
  useFixtures();
  const names = (await tools.search_sandals_resorts({ overwater_only: true, max_results: 50 })).map((r) => r.name).sort();
  assert.deepEqual(names, ["Sandals Jamaica Caribbean Cay", "Sandals Jamaica South Coast", "Sandals Royal Barbados", "Sandals St. Lucia Grand Bay", "Sandals St. Vincent"]);
  const stl = (await tools.search_sandals_resorts({ destination: "Saint Lucia" })).map((r) => r.name);
  assert.equal(stl.length, 3);
});

// ---- Copy rules: every string any tool returns (and every tool description) ----
const FORBIDDEN = [/same price as (booking )?direct/i, /co-?brand/i, /\breferral\b/i, /\bcommission/i];
const SAMPLE_ARGS = {
  search_sandals_resorts: [{}, { destination: "Jamaica", max_results: 50 }, { overwater_only: true }],
  search_beaches_resorts: [{}],
  get_resort_booking_url: [{ resort_name: "Sandals Royal Caribbean" }, { resort_name: "Beaches Ocho Rios" }, { resort_name: "Nowhere Resort", brand: "beaches" }],
  get_cruise_booking_info: [{}, { cruise_line: "Celebrity River" }],
  search_virgin_voyages: [{}],
  get_river_cruise_info: [{}],
  plan_disney_world: [{ party_size: 5, budget_level: "value" }],
  find_cruise: [{ departure_port: "Miami", passengers: 4, max_total_budget: "$6000" }],
  request_pixie_quote: [{ trip_type: "honeymoon" }],
};
function* strings(v, path = "") {
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* strings(x, `${path}[${i}]`);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) yield* strings(x, `${path}.${k}`);
}
function checkCopy(tool, value) {
  for (const [path, s] of strings(value)) {
    for (const url of s.match(/https?:\/\/[^\s"')]+/g) || []) {
      if (!/(^|\.)(sandals|beaches)\.com/i.test(new URL(url).hostname)) continue;
      assert.match(url, /^https:\/\/www\.(sandals|beaches)\.com\//, `${tool}${path}: missing www. — ${url}`);
      assert.match(url, /[?&]referral=135752(&|$)/, `${tool}${path}: missing referral — ${url}`);
    }
    const prose = s.replace(/https?:\/\/[^\s"')]+/g, "");
    for (const re of FORBIDDEN) assert.doesNotMatch(prose, re, `${tool}${path}: "${s}"`);
  }
}

test("copy rules hold for every string in every tool response", async () => {
  useFixtures();
  for (const name of Object.keys(tools)) {
    for (const args of SAMPLE_ARGS[name] || [{}]) checkCopy(name, await tools[name](args));
  }
});

test("copy rules hold for the tool list (descriptions are returned to clients too)", () => {
  checkCopy("tools/list", TOOL_SCHEMAS);
});

test("a slow 777 page doesn't hold up the reply; it fills in on the next call", async () => {
  useFixtures();
  let release;
  const gate = new Promise((r) => { release = r; });
  setFetchImpl(async (url) => {
    if (url === SOURCES.sandals_777) await gate; // pixievacations.com hanging
    return FIXTURE_FOR[url] ? new Response(fixture(FIXTURE_FOR[url]), { status: 200 }) : new Response("Access Denied", { status: 403 });
  });
  const t0 = Date.now();
  const first = await tools.get_sandals_beaches_deals();
  assert.ok(Date.now() - t0 < 3500, `reply took ${Date.now() - t0} ms`);
  assert.equal(first.sandals.sale_name, "The Great Jamaica Comeback Sale");
  assert.equal(first.promotions[2].this_week.loading, true);
  assert.equal(first.promotions[3].this_week.rooms.length, 7); // the fast 777 page still made it
  release();
  await new Promise((r) => setTimeout(r, 20));
  const second = await tools.get_sandals_beaches_deals();
  assert.equal(second.promotions[2].this_week.rooms.length, 7);
  assert.equal(second.promotions[2].this_week.loading, undefined);
});
