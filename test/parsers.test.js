// Parsers + resort catalog against saved copies of each source (captured 2026-10-27).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { parseBrandSale, parsePixieDeals, parse777, parseResortCodes, toISODate } from "../lib/parsers.js";
import { buildCatalog, resolveResort } from "../lib/live-data.js";

test("toISODate handles the date styles the sources use", () => {
  assert.equal(toISODate("November 2, 2026"), "2026-11-02");
  assert.equal(toISODate("Nov 2, 2026"), "2026-11-02");
  assert.equal(toISODate("Sept 30, 2027"), "2027-09-30");
  assert.equal(toISODate("Oct 6,2026"), "2026-10-06");
  assert.equal(toISODate("not a date"), null);
});

test("sandals.com/sale: sale name, credits, book-by date", () => {
  const d = parseBrandSale(fixture("sandals-sale"));
  assert.equal(d.sale_name, "The Great Jamaica Comeback Sale");
  assert.equal(d.instant_credit, 1500);
  assert.equal(d.air_credit, 500);
  assert.equal(d.book_by, "2026-11-02");
  assert.equal(d.travel_through, "2028-12-31");
});

test("beaches.com/sale: sale name, credits, book-by date", () => {
  const d = parseBrandSale(fixture("beaches-sale"));
  assert.equal(d.sale_name, "Winter Escapes Sale");
  assert.equal(d.instant_credit, 1400);
  assert.equal(d.air_credit, 750);
  assert.equal(d.book_by, "2026-11-02");
});

test("brand parser returns no usable sale for an unrelated page", () => {
  const d = parseBrandSale("<html><title>Sandals® Resorts | Caribbean All-Inclusive</title></html>");
  assert.equal(d.sale_name, null);
  assert.equal(d.book_by, null);
});

test("pixievacations.com/sandals-beaches-deals: per-brand sale + book-by", () => {
  const d = parsePixieDeals(fixture("pixie-deals"));
  assert.equal(d.sandals.sale_name, "The Great Jamaica Comeback Sale");
  assert.equal(d.sandals.instant_credit, 1500);
  assert.equal(d.sandals.book_by, "2026-11-02");
  assert.equal(d.beaches.sale_name, "Winter Escapes Sale");
  assert.equal(d.beaches.instant_credit, 1400);
  assert.equal(d.beaches.book_by, "2026-11-02");
});

test("777 pages: 7 rooms each with resort, suite, price; book-by = end of the week", () => {
  const s = parse777(fixture("pixie-sandals-777"));
  assert.equal(s.rooms.length, 7);
  assert.equal(s.valid_from, "2026-10-21");
  assert.equal(s.book_by, "2026-10-28");
  assert.deepEqual(s.rooms[1], { resort: "Sandals Montego Bay", location: "Montego Bay, Jamaica", suite: "Beachfront Club Villa Suite w/ Outdoor Tranquility Soaking Tub", room_code: "BCV", price_per_night: 619, child_price_per_night: null });
  const b = parse777(fixture("pixie-beaches-777"));
  assert.equal(b.rooms.length, 7);
  assert.equal(b.rooms[0].resort, "Beaches Turks & Caicos");
  assert.equal(b.rooms[0].price_per_night, 1312);
  assert.equal(b.rooms[0].child_price_per_night, 38);
});

const catalog = () => buildCatalog({
  codesHtml: fixture("beaches-resorts"), sandalsNavHtml: fixture("sandals-sale"), beachesNavHtml: fixture("beaches-resorts"),
});

test("resort catalog: current names from sandals.com/beaches.com, every open resort has a URL path", () => {
  assert.equal(Object.keys(parseResortCodes(fixture("beaches-resorts"))).length, 20);
  const c = catalog();
  const byCode = Object.fromEntries(c.resorts.map((r) => [r.code, r]));
  assert.equal(byCode.SRC.name, "Sandals Jamaica Caribbean Cay");
  assert.equal(byCode.SRC.path, "/caribbean-cay/");
  assert.equal(byCode.SGL.name, "Sandals St. Lucia Grand Bay");
  assert.equal(byCode.SGL.path, "/grand-bay/");
  assert.equal(byCode.SBD.path, "/sandals-barbados/");     // not /royal-barbados/
  assert.equal(byCode.SBR.path, "/royal-barbados/");
  assert.equal(byCode.BTC.path, "/resorts/turks-caicos/");
  for (const r of c.resorts) if (r.code !== "BBO") assert.ok(r.path, `${r.name} has no URL path`);
});

test("alias resolution: old names -> current resort; closed resort -> closed", () => {
  const c = catalog();
  const rc = resolveResort(c, "Sandals Royal Caribbean");
  assert.equal(rc.resort.name, "Sandals Jamaica Caribbean Cay");
  assert.equal(rc.resort.path, "/caribbean-cay/");
  assert.equal(resolveResort(c, "Sandals Grande St. Lucian").resort.code, "SGL");
  assert.equal(resolveResort(c, "sandals royal bahamian").resort.code, "SRB");
  assert.equal(resolveResort(c, "Sandals Saint Vincent and the Grenadines").resort.code, "SSV");
  assert.equal(resolveResort(c, "Negril").resort.code, "SNG");                // tie -> Sandals
  assert.equal(resolveResort(c, "Negril", "beaches").resort.code, "BNG");
  assert.equal(resolveResort(c, "Beaches Turks and Caicos").resort.code, "BTC");
  assert.equal(resolveResort(c, "Caribbean Cay").matched, null);             // current name, not "former"
  const closed = resolveResort(c, "Beaches Ocho Rios");
  assert.equal(closed.closed.name, "Beaches Ocho Rios");
  assert.equal(closed.closed.closed, "2025-05-31");
  assert.equal(resolveResort(c, "Sandals Atlantis Moon Base"), null);
});
