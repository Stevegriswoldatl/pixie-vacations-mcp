// Fixture-backed fetch: saved copies of each live source (captured 2026-10-27), gzipped.
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { setFetchImpl, clearPageCache } from "../lib/http.js";
import { SOURCES } from "../lib/live-data.js";

export const fixture = (name) => gunzipSync(readFileSync(new URL(`./fixtures/${name}.html.gz`, import.meta.url))).toString("utf8");

export const FIXTURE_FOR = {
  [SOURCES.sandals_sale]: "sandals-sale",
  [SOURCES.beaches_sale]: "beaches-sale",
  [SOURCES.resort_codes]: "beaches-resorts",
  [SOURCES.pixie_deals]: "pixie-deals",
  [SOURCES.sandals_777]: "pixie-sandals-777",
  [SOURCES.beaches_777]: "pixie-beaches-777",
};

// blocked: set of URLs that answer 403 "Access Denied" (what Akamai sends default clients).
export function useFixtures({ blocked = new Set() } = {}) {
  clearPageCache();
  const calls = [];
  setFetchImpl(async (url) => {
    calls.push(url);
    if (blocked.has(url) || !FIXTURE_FOR[url]) return new Response("Access Denied", { status: 403 });
    return new Response(fixture(FIXTURE_FOR[url]), { status: 200 });
  });
  return calls;
}

export async function loadServer() {
  process.env.PIXIE_MCP_NO_START = "1";
  return import("../pixie-mcp-server.js");
}
