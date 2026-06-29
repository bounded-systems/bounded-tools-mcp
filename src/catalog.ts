/**
 * The site's resource catalog VALUES: one stable MCP resource URI per
 * verifiable JSON artifact bounded.tools serves. These are the site-specific
 * descriptors the generic core projects to MCP resources.
 *
 * Only artifacts served as signed, content-addressed JSON appear here — the
 * core fetches each one and JSON-parses the verified bytes. bounded.tools'
 * Markdown / HTML pages (the blog) are signed too, but are not JSON, so they are
 * not resources.
 */

/** Manifest-relative path of the SPDX SBOM (site root, not under api/v1). */
export const SBOM_FILE = "sbom.spdx.json";

/** Manifest-relative path of the PWA web app manifest (site root). */
export const WEBMANIFEST_FILE = "site.webmanifest";

/** A stable MCP resource: a `tools://…` URI mapped to one verified artifact. */
export const STATIC_FILES: {
  uri: string;
  name: string;
  /** Manifest-relative artifact path (NOT api-prefixed). */
  path: string;
  description: string;
}[] = [
  {
    uri: "tools://conformance",
    name: "conformance",
    path: "api/v1/conformance.json",
    description:
      "Web-Build Conformance Standard report: per-criterion HTML / WCAG 2.2 / ARIA results graded against the running code.",
  },
  {
    uri: "tools://sbom",
    name: "sbom",
    path: SBOM_FILE,
    description: "SPDX software bill of materials for the bounded.tools site.",
  },
  {
    uri: "tools://webmanifest",
    name: "webmanifest",
    path: WEBMANIFEST_FILE,
    description: "The W3C web app manifest (PWA site metadata).",
  },
];
