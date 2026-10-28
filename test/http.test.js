// Back-off after a failed fetch: long after a refusal (403), short after a timeout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPage, setFetchImpl, clearPageCache } from "../lib/http.js";

async function callsAfter(failure, minutes) {
  clearPageCache();
  let calls = 0;
  setFetchImpl(async () => { calls++; return failure(); });
  await fetchPage("https://example.test/page");
  const realNow = Date.now;
  Date.now = () => realNow() + minutes * 60 * 1000;
  try { await fetchPage("https://example.test/page"); } finally { Date.now = realNow; }
  return calls;
}

const refused = () => new Response("Access Denied", { status: 403 });
const timedOut = () => { throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); };

test("403: no retry for 30 minutes", async () => {
  assert.equal(await callsAfter(refused, 5), 1);
  assert.equal(await callsAfter(refused, 31), 2);
});

test("timeout: retried after 2 minutes", async () => {
  assert.equal(await callsAfter(timedOut, 1), 1);
  assert.equal(await callsAfter(timedOut, 3), 2);
});
