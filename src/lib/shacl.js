import jsonld from "jsonld"
import { Parser as N3Parser } from "n3"
import rdfDataset from "@rdfjs/dataset"
import rdfDataModel from "@rdfjs/data-model"
import { Validator } from "shacl-engine"

import shapesTtl from "../../public/shapes/ac-shapes.ttl?raw"
import { offlineDocumentLoader } from "./ac-context"

const SH = "http://www.w3.org/ns/shacl#"

function nquadsToDataset(nquads) {
  const quads = new N3Parser({ format: "application/n-quads" }).parse(nquads)
  return rdfDataset.dataset(quads)
}

let shapesDatasetPromise
function getShapesDataset() {
  if (!shapesDatasetPromise) {
    shapesDatasetPromise = Promise.resolve().then(() => {
      const quads = new N3Parser({ format: "text/turtle" }).parse(shapesTtl)
      return rdfDataset.dataset(quads)
    })
  }
  return shapesDatasetPromise
}

function severityToLevel(severityTerm) {
  if (!severityTerm) return "err"
  if (severityTerm.value === SH + "Warning") return "warn"
  if (severityTerm.value === SH + "Info") return "warn"
  return "err"
}

function termLabel(term) {
  if (!term) return ""
  if (term.termType === "Literal") return `"${term.value}"`
  return term.value
}

/** Best-effort sh:path of the property shape a result belongs to, for a readable label. */
function shapePathLabel(shapesDataset, result) {
  try {
    const shapeTerm = result.shape?.ptr?.term
    if (!shapeTerm) return null
    for (const q of shapesDataset.match(shapeTerm, rdfDataModel.namedNode(SH + "path"), null)) {
      return q.object.value
    }
  } catch {
    /* best-effort only */
  }
  return null
}

/**
 * Convert a parsed capability document (a plain JS object, already
 * JSON.parse'd) into a SHACL validation report against the Application
 * Capability shapes.
 *
 * @param {string} [baseUrl] Base IRI to resolve relative ids/IRIs in the
 *   document against (e.g. "#app", "shapes/foo.ttl#Bar"). Defaults to this
 *   page's own URL, which is only meaningful when the document was pasted
 *   in rather than fetched from its real location.
 * @returns {Promise<{ conforms: boolean, issues: { level: 'ok'|'warn'|'err', text: string }[] }>}
 */
export async function validateWithShacl(doc, baseUrl) {
  const issues = []

  let nquads
  try {
    nquads = await jsonld.toRDF(doc, {
      base: baseUrl || location.href,
      format: "application/n-quads",
      documentLoader: offlineDocumentLoader,
    })
  } catch (e) {
    console.error("validateWithShacl: jsonld.toRDF failed:", e)
    return {
      conforms: false,
      issues: [{ level: "err", text: `Could not interpret this document as JSON-LD: ${e.message}` }],
    }
  }

  if (!nquads.trim()) {
    return {
      conforms: false,
      issues: [
        {
          level: "err",
          text: "The document produced zero RDF triples — check that @context resolves to the Application Capability context.",
        },
      ],
    }
  }

  const dataDataset = nquadsToDataset(nquads)
  const shapesDataset = await getShapesDataset()

  const validator = new Validator(shapesDataset, { factory: rdfDataModel })
  const report = await validator.validate({ dataset: dataDataset })

  if (report.results.length === 0) {
    issues.push({ level: "ok", text: "Conforms to the Application Capability SHACL shapes — no violations." })
  }

  // shacl-engine can report the same violation more than once when more than one path
  // through the shapes graph reaches the same (focus node, constraint) pair — de-dupe on
  // the fully-rendered message so the UI never shows an identical line twice.
  const seen = new Set()

  for (const result of report.results) {
    const level = severityToLevel(result.severity)
    const messages = (result.message || []).map((m) => m.value)
    const path = shapePathLabel(shapesDataset, result)
    const focus = result.focusNode?.term ? termLabel(result.focusNode.term) : ""

    let text = messages.length > 0 ? messages.join(" ") : "Constraint violated."
    const suffix = [path ? `path: ${path}` : null, focus ? `on: ${focus}` : null].filter(Boolean).join(", ")
    if (suffix) text = `${text} (${suffix})`

    const dedupeKey = `${level}|${text}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    issues.push({ level, text, focusNode: result.focusNode?.term ? result.focusNode.term.value : null })
  }

  return { conforms: report.conforms, issues }
}
