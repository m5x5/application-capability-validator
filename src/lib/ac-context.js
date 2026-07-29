// Vendored Application Capability JSON-LD context, shared by the SHACL pipeline (shacl.js) and
// discovery/compaction (discover-capability.js). See src/shapes/ac-context.jsonld for provenance.
import acContextRaw from "../shapes/ac-context.jsonld?raw"

export const AC_CONTEXT_URL = "https://www.w3.org/ns/ac.jsonld"
export const acContext = JSON.parse(acContextRaw)

/**
 * Offline document loader: serves the vendored Application Capability context for its
 * canonical URL, refuses everything else so validation never depends on network access
 * (and never silently no-ops on a 404, which is what the real
 * https://www.w3.org/ns/ac.jsonld currently returns — the spec is still an editor's draft
 * and hasn't published it yet).
 */
export async function offlineDocumentLoader(url) {
  if (url === AC_CONTEXT_URL) {
    return { contextUrl: null, document: acContext, documentUrl: url }
  }
  throw new Error(
    `Refusing to fetch remote context "${url}" — this validator only resolves ${AC_CONTEXT_URL} ` +
      "(vendored locally) so it can run fully offline. Documents using additional external contexts " +
      "aren't supported yet."
  )
}
