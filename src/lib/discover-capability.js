import jsonld from "jsonld"
import { AC_CONTEXT_URL, offlineDocumentLoader } from "./ac-context"

function nodeId(node) {
  return node && (node.id || node["@id"])
}

// Properties whose values are themselves node references that may need resolving one level
// further (ac:Capability -> ac:invocation -> ac:mapping).
const NESTED_REF_PROPERTIES = ["invocation", "mapping"]

/**
 * Resolve bare-IRI/`{id}` references in `value` into the full node objects they point to
 * elsewhere in the graph, via `byId` — recursively, for any nested reference properties
 * (`invocation`, `mapping`) those nodes carry in turn. Some servers (our own two apps) embed
 * these nodes inline; others (dokie.li itself) only link to them by IRI from their parent,
 * describing them as separate nodes in the same graph — this makes both look the same to
 * callers. De-duplicates by resolved id, since RDFa extraction can easily emit the same
 * statement twice (e.g. a duplicated menu in the markup). `seenIds` guards against reference
 * cycles.
 */
function resolveRefs(value, byId, seenIds = new Set()) {
  const items = Array.isArray(value) ? value : [value]
  const seen = new Set()
  const resolved = []

  for (const item of items) {
    const id = typeof item === "string" ? item : nodeId(item)
    if (id && seenIds.has(id)) continue

    const node = (id && byId.get(id)) || item
    const key = nodeId(node) || id || JSON.stringify(node)
    if (seen.has(key)) continue
    seen.add(key)

    if (typeof node !== "object" || node === null) {
      resolved.push(node)
      continue
    }

    const nextSeenIds = id ? new Set(seenIds).add(id) : seenIds
    const full = { ...node, id: nodeId(node) || id }
    for (const prop of NESTED_REF_PROPERTIES) {
      if (prop in full) full[prop] = resolveRefs(full[prop], byId, nextSeenIds)
    }
    resolved.push(full)
  }

  return resolved
}

/**
 * Given a parsed JSON(-LD) response body from a content-negotiated fetch, find the
 * Application Capability document within it. Handles two shapes:
 *
 * 1. The common case: a single compact object with `capability`/`requirement`/`@context`
 *    at the top level (or the first element of a top-level array of one).
 * 2. A server that content-negotiates its whole RDF graph as *expanded* JSON-LD — e.g.
 *    dokie.li itself returns its entire page's RDFa as one large `[{...}, {...}, ...]`
 *    array of expanded nodes, with the capability/requirement/invocation/mapping nodes
 *    described separately from the root node and each other, linked only by IRI. For that
 *    case, compact the whole thing against the AC context, find the root node, and resolve
 *    its capability/requirement references (and their own nested invocation/mapping
 *    references) against the rest of the graph so the returned document is self-contained
 *    (needed both for accurate SHACL validation and for display).
 *
 * `baseUrl` should be the *actually resolved* fetch URL (e.g. `response.url`, which reflects
 * redirects and browser URL normalization), not necessarily the URL the user typed — a bare
 * origin like "https://example.org" normalizes to "https://example.org/", and resolving
 * "#foo" against the two gives different IRIs ("https://example.org#foo" vs
 * "https://example.org/#foo"), which would silently fail to match the graph's real node ids.
 *
 * Returns null if nothing resembling a capability document was found either way.
 */
export async function findCapabilityDoc(parsed, baseUrl) {
  const direct = Array.isArray(parsed) ? parsed[0] : parsed
  if (direct && typeof direct === "object" && !Array.isArray(direct) && ("capability" in direct || direct["@context"])) {
    return direct
  }

  try {
    const compacted = await jsonld.compact(parsed, AC_CONTEXT_URL, {
      base: baseUrl,
      documentLoader: offlineDocumentLoader,
    })

    if ("capability" in compacted || "requirement" in compacted) return compacted

    const graph = Array.isArray(compacted["@graph"]) ? compacted["@graph"] : []
    const root = graph.find((node) => node && ("capability" in node || "requirement" in node))
    if (!root) return null

    const byId = new Map()
    for (const node of graph) {
      const id = nodeId(node)
      if (id) byId.set(id, node)
    }

    const rootId = nodeId(root)
    const seenIds = rootId ? new Set([rootId]) : new Set()
    const result = { "@context": compacted["@context"], ...root }
    if ("capability" in root) result.capability = resolveRefs(root.capability, byId, seenIds)
    if ("requirement" in root) result.requirement = resolveRefs(root.requirement, byId, seenIds)
    return result
  } catch {
    // Not compactible under our context (e.g. genuinely unrelated JSON), or nothing found —
    // either way, the caller treats a null return as "no capability document here."
  }

  return null
}
