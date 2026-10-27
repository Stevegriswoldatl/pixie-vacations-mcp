// Integration: calls the real sources. Skips itself when the machine is offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadServer } from "./helpers.js";
import { clearPageCache, setFetchImpl } from "../lib/http.js";

const online = await fetch("https://pixievacations.com/", { method: "HEAD", signal: AbortSignal.timeout(5000) }).then(() => true, () => false);

test("live get_sandals_beaches_deals: book-by in the future, fetched today", { skip: !online && "offline" }, async () => {
  setFetchImpl((...a) => globalThis.fetch(...a));
  clearPageCache();
  const { tools } = await loadServer();
  const t0 = Date.now();
  const d = await tools.get_sandals_beaches_deals();
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(d.fetched_at.slice(0, 10), today);
  for (const brand of ["sandals", "beaches"]) {
    assert.ok(d[brand].sale_name, `${brand} sale name`);
    assert.ok(d[brand].book_by >= today, `${brand} book_by ${d[brand].book_by} is in the past`);
  }
  console.log(`cold call: ${Date.now() - t0} ms; sandals from ${d.sandals.source_url}; beaches from ${d.beaches.source_url}`);
});
