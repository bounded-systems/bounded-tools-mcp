# @bounded-systems/bounded-tools-mcp

A **local, read-only [MCP](https://modelcontextprotocol.io) server** (and a
matching CLI) over [bounded.tools](https://bounded.tools)' **signed static API**.

It exposes the parts of the site that are served as **verifiable, content-addressed
JSON** — the Web-Build Conformance report and the SPDX SBOM — to any MCP client
(Claude Desktop, Claude Code, etc.), and **verifies every response byte-for-byte
against the site's Sigstore-signed `sha256` manifest** before handing it back. If
the bytes a client would receive don't match the signed manifest, it refuses to
return them.

It runs **locally over stdio** — the client spawns it as a subprocess. There is
no hosted server and no network listener, which preserves the site's
static / no-attack-surface posture.

## A thin implementation of a generic core

This package is **thin**. All of the reusable machinery — the verifying fetch
client, the `sha256` manifest + Sigstore checks, and the
`VerbSpec → MCP (tools + resources)` / `VerbSpec → CLI` projection — lives in
[`@bounded-systems/static-mcp`](https://github.com/bounded-systems/static-mcp).
bounded-tools-mcp supplies only:

- **the verbs** ([`src/verbs.ts`](./src/verbs.ts)) — `get_conformance`,
  `get_sbom`, each authored once as a
  [`@bounded-systems/verbspec`](https://jsr.io/@bounded-systems/verbspec) `VerbSpec`;
- **the resource catalog** ([`src/catalog.ts`](./src/catalog.ts)) — the
  `tools://…` resources;
- **the config values** ([`src/config.ts`](./src/config.ts)) — the origin and
  expected signer identity; and
- **the entry** ([`src/index.ts`](./src/index.ts)) — which picks a surface and
  hands the spec to the core.

```
src/verbs.ts ─┐
src/catalog.ts ├─▶ buildToolsSpec(config) ─▶ @bounded-systems/static-mcp
src/config.ts ─┘        serveVerifiedStaticMcp(spec, config)   (MCP, stdio)
                        runStaticCli(spec, config, argv)        (CLI)
```

> **Two surfaces, one definition.** verbspec projects each verb to **both** an
> MCP tool and a CLI subcommand. The exact same verb set backs the MCP tools and
> the CLI commands — no second definition, no drift.

## What's exposed (and what isn't)

bounded.tools is a static site whose **verifiable surface is intentionally
small**. Only artifacts the site serves as **signed, content-addressed JSON** are
exposed here — each is fetched and verified byte-for-byte against the signed
manifest:

| Served as | Artifact | Exposed |
| --------- | -------- | ------- |
| **signed JSON** | `api/v1/conformance.json` | ✅ `get_conformance` · `tools://conformance` |
| **signed JSON** | `sbom.spdx.json` | ✅ `get_sbom` · `tools://sbom` |
| **signed JSON** | `site.webmanifest` | ✅ `tools://webmanifest` (resource only) |
| signed **HTML + Markdown** | the blog (`blog/*.html`, `blog/*.md`) | ❌ not JSON — see below |

> **Honesty over surface area.** The blog *is* covered by the signed manifest,
> but it is served as HTML + Markdown, not as a JSON feed or per-post JSON
> documents. The verified-static core fetches-and-JSON-parses each artifact, so
> exposing the blog as a "tool" would mean fabricating a JSON shape the site does
> not actually serve. It is therefore left out rather than faked. If bounded.tools
> later publishes a signed `posts.json` (and per-post JSON), `list_posts` /
> `get_post` verbs drop straight in, exactly as in
> [`site-mcp`](https://github.com/bounded-systems/site-mcp).

## Install / run

Requires Node ≥ 18.17. The verbspec dependency is published to JSR, so installs
resolve it through JSR's npm bridge — the included [`.npmrc`](./.npmrc) sets
`@jsr:registry=https://npm.jsr.io`. (Consuming from a fresh environment, add that
one line to your npm config.)

```bash
# MCP server over stdio (what an MCP client launches):
npx -y @bounded-systems/bounded-tools-mcp

# CLI — the SAME verbs, printing the verified JSON:
npx -y @bounded-systems/bounded-tools-mcp get_conformance
npx -y @bounded-systems/bounded-tools-mcp get_sbom
```

The MCP server logs a readiness line to **stderr** (stdout is the MCP channel):

```
bounded-tools-mcp ready (stdio) → https://bounded.tools; signature mode=off
```

## MCP client configuration

```json
{
  "mcpServers": {
    "bounded-tools": {
      "command": "npx",
      "args": ["-y", "@bounded-systems/bounded-tools-mcp"],
      "env": { "BOUNDED_TOOLS_MCP_SIGNATURE_MODE": "warn" }
    }
  }
}
```

## Resources

| Resource URI            | Endpoint                  | Contents |
| ----------------------- | ------------------------- | -------- |
| `tools://conformance`   | `api/v1/conformance.json` | Web-Build Conformance Standard report (HTML / WCAG 2.2 / ARIA) |
| `tools://sbom`          | `sbom.spdx.json`          | SPDX software bill of materials |
| `tools://webmanifest`   | `site.webmanifest`        | W3C web app manifest (PWA site metadata) |

## Tools / CLI commands (read-only)

The same two verbs, on both surfaces:

| Tool / command    | Args | Returns |
| ----------------- | ---- | ------- |
| `get_conformance` | —    | The Web-Build Conformance report |
| `get_sbom`        | —    | The SPDX software bill of materials |

Resource reads and tool results carry a `_meta.verification` block (the
manifest-relative path, source URL, the verified `sha256`, and the manifest
signature status). The CLI prints the verified JSON; a verification failure exits
non-zero with nothing on stdout.

## Verification / trust model

The site publishes a single signed manifest, `https://bounded.tools/site.sha256`
(`sha256sum` format), and a Sigstore bundle over it, `site.sha256.sigstore.json`.
The core enforces:

1. **Per-file hash check (always on).** Fetch the manifest once per process; for
   every resource, fetch it, SHA-256 the received bytes, and require that digest
   to equal the manifest entry. A tampered file, a stale CDN edge, or a MITM →
   mismatch → `VerificationError` instead of a response. A path absent from the
   manifest is likewise refused.
2. **Manifest signature check (optional).** `BOUNDED_TOOLS_MCP_SIGNATURE_MODE=warn|require`
   verifies the Sigstore bundle against the deploy workflow identity
   (`…/bounded-systems/site/.github/workflows/deploy.yml@refs/heads/main`, OIDC
   issuer `https://token.actions.githubusercontent.com`). This is the same
   keyless identity published in
   [`https://bounded.tools/provenance.json`](https://bounded.tools/provenance.json).

## Configuration

| Variable                            | Default | Meaning |
| ----------------------------------- | ------- | ------- |
| `BOUNDED_TOOLS_MCP_BASE_URL`        | `https://bounded.tools` | Origin serving the site + API + manifest |
| `BOUNDED_TOOLS_MCP_SIGNATURE_MODE`  | `off`   | `off` \| `warn` \| `require` |
| `BOUNDED_TOOLS_MCP_SIGNER_IDENTITY` | deploy workflow SAN | Expected Sigstore certificate identity |
| `BOUNDED_TOOLS_MCP_SIGNER_ISSUER`   | GitHub Actions OIDC | Expected Sigstore OIDC issuer |
| `BOUNDED_TOOLS_MCP_FETCH_TIMEOUT_MS`| `15000` | Per-request fetch timeout |

## Development

```bash
npm install         # resolves @bounded-systems/static-mcp (npm) + verbspec (JSR bridge)
npm run build       # tsc → dist/
npm test            # node --test via tsx (server + CLI; no network)
npm run typecheck
node scripts/headless-check.mjs   # live end-to-end against bounded.tools
```

## Publishing

**One tag publishes the same version to three registries, mirrored.** Pushing a
`v*` tag runs [`publish.yml`](./.github/workflows/publish.yml), which fans out to:

| # | Registry | Identifier | Auth |
| - | -------- | ---------- | ---- |
| 1 | **npm** | `@bounded-systems/bounded-tools-mcp` | trusted publishing (OIDC) + [provenance](https://docs.npmjs.com/generating-provenance-statements) |
| 2 | **JSR** (mirror) | `@bounded-systems/bounded-tools-mcp` | tokenless OIDC (`npx jsr publish`) |
| 3 | **MCP Registry** | `io.github.bounded-systems/bounded-tools-mcp` | GitHub-OIDC namespace auth (`mcp-publisher`) |

There are **no long-lived secrets** — every registry authenticates with the
job's short-lived GitHub Actions OIDC token (`id-token: write`). npm needs
npm ≥ 11.5 (the workflow upgrades npm to guarantee this). The `mcp-registry` job
is **decoupled from the `npm` job** (`needs: verify`, NOT `needs: npm`): the
registry proves package ownership by reading the `mcpName` field off the
already-published npm package, so it can run/retry independently.

> [!IMPORTANT]
> **Versions must stay in sync.** The release version lives in **four** places
> that must all match: `package.json`, `deno.json`, `server.json`, and the
> `v<version>` git tag. The workflow's `verify` job hard-fails the whole release
> on any mismatch, so npm and JSR can never drift apart. The MCP Registry also
> requires `package.json` to carry
> `"mcpName": "io.github.bounded-systems/bounded-tools-mcp"` (it reads that field
> off the published npm package to prove ownership).

### One-time setup (maintainer) — do these BEFORE the first tag

**(a) npm — Trusted Publisher** (on [npmjs.com](https://www.npmjs.com/))

1. Sign in as an owner of the `@bounded-systems` scope.
2. Open the package page for **`@bounded-systems/bounded-tools-mcp`** →
   **Settings** → **Trusted Publisher**. For a brand-new package you may need to
   publish `0.1.0` once manually (or create the package), then switch to trusted
   publishing.
3. Choose **GitHub Actions** and enter:
   - **Organization / user:** `bounded-systems`
   - **Repository:** `bounded-tools-mcp`
   - **Workflow filename:** `publish.yml`
   - **Environment:** *(leave blank)*
4. Save. No token is generated or stored anywhere.

**(b) JSR — create + link the package** (on [jsr.io](https://jsr.io/))

1. Sign in to jsr.io with GitHub and create the package
   **`@bounded-systems/bounded-tools-mcp`** under the `@bounded-systems` scope.
2. Open the package's **Settings** tab → under **GitHub Repository** enter
   `bounded-systems/bounded-tools-mcp` and click **Link**. Linking the repo
   enables **tokenless OIDC publishing** from this workflow.

**(c) MCP Registry — nothing to pre-authorize**

The `io.github.bounded-systems/*` namespace is **auto-authorized via GitHub
OIDC**: because this repo lives under `github.com/bounded-systems`,
`mcp-publisher login github-oidc` proves ownership from the Actions run itself.

### Cut a release (the single command)

```bash
# 1. Bump the version in ALL of: package.json, deno.json, server.json. Commit.
# 2. Tag with the SAME version and push — this is the only command:
git tag v0.1.0 && git push origin v0.1.0
```

### Local dry-runs (verify without publishing)

```bash
npm pack --dry-run                                   # npm tarball contents
npx --yes jsr publish --dry-run --allow-slow-types   # JSR (or: deno publish --dry-run --allow-slow-types)
mcp-publisher validate ./server.json                 # MCP Registry schema check
```

> bounded-tools-mcp depends on `@bounded-systems/static-mcp`; that core is
> published independently (its own `v*` tag → JSR + npm) before cutting this tag.

## License

MIT — see [LICENSE](./LICENSE).
