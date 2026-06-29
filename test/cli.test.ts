/**
 * The site's verbs run as a CLI — the SAME verb set that backs the MCP tools,
 * projected to the other surface by `@bounded-systems/static-mcp` (via verbspec).
 * Verified bytes on stdout; a tampered artifact fails closed. No network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, runStaticCli, sha256Hex } from "@bounded-systems/static-mcp";
import { resolveConfig } from "../src/config.js";
import { buildToolsSpec } from "../src/server.js";

const enc = (s: string) => new TextEncoder().encode(s);
const config = resolveConfig({
  BOUNDED_TOOLS_MCP_BASE_URL: "https://example.test",
  BOUNDED_TOOLS_MCP_SIGNATURE_MODE: "off",
} as NodeJS.ProcessEnv);
const spec = buildToolsSpec(config);

function fakeFetch(files: Record<string, string>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const body = files[url];
    if (body === undefined) return new Response("nf", { status: 404, statusText: "Not Found" });
    return new Response(enc(body), { status: 200 });
  }) as unknown as typeof fetch;
}

function fixture(tamper = false) {
  const conformance = '{"standard":"Bounded Systems Web-Build Conformance Standard","results":[]}';
  const sbom = '{"spdxVersion":"SPDX-2.3","packages":[]}';
  const at = (p: string) => `https://example.test/${p}`;
  const manifest =
    `${sha256Hex(enc(conformance))}  api/v1/conformance.json\n` +
    `${sha256Hex(enc(sbom))}  sbom.spdx.json\n`;
  return {
    [at("site.sha256")]: manifest,
    [at("api/v1/conformance.json")]: tamper ? '{"standard":"EVIL"}' : conformance,
    [at("sbom.spdx.json")]: sbom,
  } as Record<string, string>;
}

const run = (argv: string[], files = fixture()) =>
  runStaticCli(spec, config, argv, new ApiClient(config, fakeFetch(files)));

test("`bounded-tools-mcp get_conformance` prints the verified report", async () => {
  const r = await run(["get_conformance"]);
  assert.equal(r.code, 0);
  assert.ok("results" in JSON.parse(r.stdout));
});

test("`bounded-tools-mcp get_sbom` prints the verified SBOM", async () => {
  const r = await run(["get_sbom"]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).spdxVersion, "SPDX-2.3");
});

test("a tampered artifact fails closed (exit 1, empty stdout)", async () => {
  const r = await run(["get_conformance"], fixture(true));
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /digest mismatch/);
});

test("usage lists the two site commands", async () => {
  const r = await run([]);
  assert.match(r.stdout, /get_conformance/);
  assert.match(r.stdout, /get_sbom/);
});
