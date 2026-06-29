/**
 * The site's read-only verbs, authored once as `@bounded-systems/verbspec`
 * VerbSpecs (via the core's {@link verifiedVerb} helper). Each one resolves its
 * input to a manifest-relative artifact path; the core fetches + verifies it and
 * projects the verb to an MCP tool. There is no per-tool handler boilerplate and
 * no drift between the verb and its MCP surface.
 *
 * bounded.tools' verifiable JSON surface is small and deliberate: the
 * conformance report (`api/v1/conformance.json`) and the SBOM
 * (`sbom.spdx.json`). Those are the only two artifacts the site serves as
 * signed, content-addressed JSON, so those are the only two verbs. The blog is
 * served as signed HTML + Markdown (not JSON) and is intentionally NOT exposed
 * as a tool — see the README.
 */
import { z } from "zod";
import { verifiedVerb, type Registry } from "@bounded-systems/static-mcp";
import { SBOM_FILE } from "./catalog.js";

/** The bounded.tools verb registry → MCP tools. */
export const toolsVerbs: Registry = {
  get_conformance: verifiedVerb({
    id: "get_conformance",
    summary:
      "Fetch bounded.tools' Web-Build Conformance Standard report (per-criterion HTML / WCAG / ARIA results), verified against the signed manifest.",
    input: z.object({}),
    resolve: (_input, deps) => deps.apiPath("conformance.json"),
  }),

  get_sbom: verifiedVerb({
    id: "get_sbom",
    summary:
      "Fetch bounded.tools' SPDX software bill of materials (site dependencies), verified against the signed manifest.",
    input: z.object({}),
    // The SBOM lives at the site root, not under api/v1 — a bare
    // manifest-relative path (the resolve return value is verified as-is).
    resolve: () => SBOM_FILE,
  }),
};
