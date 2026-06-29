/**
 * The site's MCP server, end-to-end over an in-memory transport pair. Proves the
 * thin implementation exposes the expected tools + resources and that the core's
 * verified-response behavior (verification `_meta`, tamper rejection) is intact —
 * all offline, against a fake signed origin.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, sha256Hex } from "@bounded-systems/static-mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resolveConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const enc = (s: string) => new TextEncoder().encode(s);

const config = resolveConfig({
  BOUNDED_TOOLS_MCP_BASE_URL: "https://example.test",
  BOUNDED_TOOLS_MCP_SIGNATURE_MODE: "off",
} as NodeJS.ProcessEnv);

function fakeFetch(files: Record<string, string>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    const body = files[url];
    if (body === undefined) {
      return new Response("not found", { status: 404, statusText: "Not Found" });
    }
    return new Response(enc(body), { status: 200 });
  }) as unknown as typeof fetch;
}

function fixture(tamper = false) {
  const conformance = '{"standard":"Bounded Systems Web-Build Conformance Standard","results":[]}';
  const sbom = '{"spdxVersion":"SPDX-2.3","name":"bounded-tools-site","packages":[]}';
  const webmanifest = '{"name":"Bounded Systems","short_name":"bounded.tools"}';
  const at = (p: string) => `https://example.test/${p}`;
  const manifest =
    `${sha256Hex(enc(conformance))}  api/v1/conformance.json\n` +
    `${sha256Hex(enc(sbom))}  sbom.spdx.json\n` +
    `${sha256Hex(enc(webmanifest))}  site.webmanifest\n`;
  return {
    [at("site.sha256")]: manifest,
    [at("api/v1/conformance.json")]: tamper ? '{"standard":"EVIL"}' : conformance,
    [at("sbom.spdx.json")]: sbom,
    [at("site.webmanifest")]: webmanifest,
  } as Record<string, string>;
}

async function connect(files: Record<string, string>) {
  const server = buildServer(config, new ApiClient(config, fakeFetch(files)));
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return { client, server };
}

test("exposes the two bounded.tools tools", async () => {
  const { client, server } = await connect(fixture());
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["get_conformance", "get_sbom"]);
  await server.close();
});

test("exposes the static resources", async () => {
  const { client, server } = await connect(fixture());
  const uris = (await client.listResources()).resources.map((r) => r.uri);
  for (const u of ["tools://conformance", "tools://sbom", "tools://webmanifest"]) {
    assert.ok(uris.includes(u), `missing resource ${u}`);
  }
  await server.close();
});

test("get_conformance returns verified content + verification _meta", async () => {
  const { client, server } = await connect(fixture());
  const res: any = await client.callTool({ name: "get_conformance", arguments: {} });
  assert.ok("results" in JSON.parse(res.content[0].text));
  assert.equal(res._meta.verification.matchedSignedManifest, true);
  assert.equal(res._meta.verification.path, "api/v1/conformance.json");
  await server.close();
});

test("get_sbom returns the verified root-level SBOM", async () => {
  const { client, server } = await connect(fixture());
  const res: any = await client.callTool({ name: "get_sbom", arguments: {} });
  assert.equal(JSON.parse(res.content[0].text).spdxVersion, "SPDX-2.3");
  assert.equal(res._meta.verification.matchedSignedManifest, true);
  assert.equal(res._meta.verification.path, "sbom.spdx.json");
  await server.close();
});

test("a tampered conformance resource is rejected", async () => {
  const { client, server } = await connect(fixture(true));
  // readResource surfaces the verification failure as a protocol error (reject).
  await assert.rejects(
    () => client.readResource({ uri: "tools://conformance" }),
    /digest mismatch/,
  );
  await server.close();
});
