/**
 * Assemble bounded.tools' {@link StaticMcpSpec} (verbs + resource catalog +
 * server identity) and hand it to the generic core. All the verified-fetch /
 * manifest / Sigstore machinery and the VerbSpec → MCP projection live in
 * `@bounded-systems/static-mcp`; this file is just the site's values.
 */
import {
  ApiClient,
  buildVerifiedStaticServer,
  type Config,
  type StaticMcpSpec,
  type VerifiedResource,
} from "@bounded-systems/static-mcp";
import { STATIC_FILES } from "./catalog.js";
import { toolsVerbs } from "./verbs.js";

const PKG_VERSION = "0.1.0";

/** Build the full spec the core serves: bounded.tools verbs + resources + identity. */
export function buildToolsSpec(config: Config): StaticMcpSpec {
  const resources: VerifiedResource[] = STATIC_FILES.map((r) => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    // The catalog already carries full manifest-relative paths (some under
    // api/v1, some at the site root), so pass them through verbatim.
    path: r.path,
  }));

  return {
    server: {
      name: "bounded-tools-mcp",
      version: PKG_VERSION,
      instructions:
        `Read-only access to ${config.baseUrl}'s signed static API. Every ` +
        `resource and tool result is verified byte-for-byte against the site's ` +
        `Sigstore-signed sha256 manifest before being returned; a mismatch is an error.`,
    },
    verbs: toolsVerbs,
    resources,
  };
}

/**
 * Build (but do not connect) the site's MCP server. A test can inject a fake
 * {@link ApiClient} (backed by an in-memory fetch) to exercise the wiring
 * offline; production omits it and the core constructs a real one.
 */
export function buildServer(config: Config, client?: ApiClient) {
  return buildVerifiedStaticServer(buildToolsSpec(config), config, client);
}
