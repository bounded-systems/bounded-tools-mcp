/**
 * Site-specific configuration VALUES. The verified-static engine + its `Config`
 * shape live in `@bounded-systems/static-mcp`; this file only resolves
 * bounded.tools' values from the environment. The server is read-only — the only
 * things worth configuring are the origin and how strictly the Sigstore
 * signature is enforced.
 */
import { withDefaults, type Config } from "@bounded-systems/static-mcp";

export type { Config } from "@bounded-systems/static-mcp";

/** Resolve bounded.tools' {@link Config} from the environment. */
export function resolveConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const signatureMode = ((): Config["signatureMode"] => {
    const raw = (env.BOUNDED_TOOLS_MCP_SIGNATURE_MODE || "off").toLowerCase();
    if (raw === "warn" || raw === "require" || raw === "off") return raw;
    return "off";
  })();

  return withDefaults({
    baseUrl: env.BOUNDED_TOOLS_MCP_BASE_URL || "https://bounded.tools",
    apiPrefix: "api/v1",
    manifestPath: "site.sha256",
    signaturePath: "site.sha256.sigstore.json",
    signatureMode,
    expectedSignerIdentity:
      env.BOUNDED_TOOLS_MCP_SIGNER_IDENTITY ||
      "https://github.com/bounded-systems/site/.github/workflows/deploy.yml@refs/heads/main",
    expectedSignerIssuer:
      env.BOUNDED_TOOLS_MCP_SIGNER_ISSUER ||
      "https://token.actions.githubusercontent.com",
    fetchTimeoutMs: Number(env.BOUNDED_TOOLS_MCP_FETCH_TIMEOUT_MS) || 15000,
  });
}
