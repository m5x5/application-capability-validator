// Application Capability (https://dokieli.github.io/application-capability/)
// discovery + validation helpers. Pure functions, no DOM/React dependency
// except DOMParser (browser built-in).

export const AC_CONTEXT = "https://www.w3.org/ns/ac.jsonld"

export function resolveUrl(maybeRelative, base) {
  try {
    return new URL(maybeRelative, base || window.location.href).href
  } catch {
    return maybeRelative
  }
}

export function isPlausibleIri(value) {
  if (typeof value !== "string" || value.length === 0) return false
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || value.startsWith("/") || value.startsWith("#") || !value.includes(" ")
}

export function asArray(v) {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

/**
 * `capability`/`requirement` array entries are usually embedded node objects, but JSON-LD also
 * allows a bare IRI string as shorthand for `{"@id": "..."}` — a reference to a node described
 * elsewhere (or not at all, in this document). Normalize those to `{ id }` so callers can treat
 * every entry uniformly instead of silently losing string entries to `undefined` field lookups.
 */
export function asNodeArray(v) {
  return asArray(v).map((item) => (typeof item === "string" ? { id: item } : item))
}

export function short(v) {
  if (v === undefined || v === null) return ""
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.map(short).join(", ")
    // Expanded JSON-LD literal, e.g. {"@value": "search", "@type": "..."} or
    // {"@value": "...", "@language": "en"} — unwrap to the plain literal value.
    if ("@value" in v) return String(v["@value"])
    return v.id || v["@id"] || JSON.stringify(v)
  }
  return String(v)
}

/** Group `items` by `keyFn(item)`, preserving first-seen key order. */
export function groupBy(items, keyFn) {
  const order = []
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(item)
  }
  return order.map((key) => [key, groups.get(key)])
}

/** Local name of a compact/absolute IRI-ish action value, e.g. "odrl:read" -> "read". */
function actionLocalName(action) {
  const s = short(action)
  return s.includes(":") ? s.split(":").pop() : s
}

/**
 * Display-only merge of capabilities that are identical except for `id`/`action` —
 * the shape one multi-action capability takes once split into one-action-per-capability
 * for SHACL conformance (see ac-shapes.ttl: a Capability declares exactly one action).
 * Collapses them back into a single row with a combined action list, so the UI shows one
 * card's worth of capability once rather than once per action. Does not affect validation.
 *
 * Matching metadata alone isn't enough to prove two capabilities are an action-split of the
 * same logical one — two genuinely unrelated capabilities can easily share identical (or
 * identically absent) resourceType/shape/accept/output/summary. So the merge key also
 * requires the ids to actually fit the "<base>-<action>" pattern this split produces: each
 * cap's own id, with its own action's local name stripped as a suffix if present, must agree
 * across the group. Unrelated capabilities then get distinct base ids and are never merged.
 */
export function mergeCapabilitiesForDisplay(caps) {
  const order = []
  const merged = new Map()

  for (const cap of caps) {
    const ownId = short(cap.id || cap["@id"])
    const ownActionSuffix = `-${actionLocalName(cap.action)}`
    const baseId = ownId.endsWith(ownActionSuffix) ? ownId.slice(0, -ownActionSuffix.length) : ownId

    const signature = JSON.stringify({
      baseId,
      resourceType: short(cap.resourceType),
      shape: short(cap.shape),
      accept: short(cap.accept),
      output: short(cap.output),
      summary: cap["as:summary"] || cap.summary || "",
    })

    if (!merged.has(signature)) {
      merged.set(signature, { ...cap, ids: [], actions: [] })
      order.push(signature)
    }
    const entry = merged.get(signature)
    const id = short(cap.id || cap["@id"])
    if (!entry.ids.includes(id)) entry.ids.push(id)
    const action = short(cap.action)
    if (action && !entry.actions.includes(action)) entry.actions.push(action)
  }

  return order.map((signature) => {
    const { ids, actions, ...rest } = merged.get(signature)
    const localNames = actions.map(actionLocalName)
    // If every id is exactly "<baseId>-<its own action's local name>", the ids only
    // differ by the split-off action suffix — collapse to that shared base id.
    const baseIds = ids.map((id, i) => {
      const suffix = `-${localNames[i]}`
      return id.endsWith(suffix) ? id.slice(0, -suffix.length) : null
    })
    const collapsedId = baseIds.every((b) => b !== null && b === baseIds[0]) ? baseIds[0] : ids.join(", ")

    // `ids` (every original id this display row was merged from) is kept alongside the
    // collapsed display `id` so callers can still match this row against per-node SHACL
    // results, which are keyed by the original (un-merged) node IRIs.
    return { ...rest, id: collapsedId, ids, action: actions.join(", ") }
  })
}

/**
 * Scan raw HTML for Application Capability discovery points:
 * - <link rel="application-capability" href="...">
 * - <link rel="describedby" type=".../ld+json">
 * - <script type="application/ld+json"> blocks that look like an AC document
 */
export function discoverFromHtml(htmlText, baseUrl) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html")
  const links = []

  doc.querySelectorAll('link[rel~="application-capability"]').forEach((link) => {
    links.push({
      via: "link[rel=application-capability]",
      href: resolveUrl(link.getAttribute("href"), baseUrl),
      type: link.getAttribute("type") || "(unspecified)",
    })
  })

  doc.querySelectorAll('link[rel~="describedby"]').forEach((link) => {
    const t = link.getAttribute("type") || ""
    if (t.includes("ld+json")) {
      links.push({
        via: "link[rel=describedby]",
        href: resolveUrl(link.getAttribute("href"), baseUrl),
        type: t,
      })
    }
  })

  const embedded = []
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script, i) => {
    try {
      const parsed = JSON.parse(script.textContent)
      const ctx = parsed["@context"]
      const looksLikeAc = ctx === AC_CONTEXT || (Array.isArray(ctx) && ctx.includes(AC_CONTEXT)) || "capability" in parsed
      if (looksLikeAc) embedded.push({ index: i, doc: parsed })
    } catch {
      // not valid JSON, skip
    }
  })

  return { links, embedded }
}

// Structural validation itself lives in ./shacl.js — it runs the document
// through a real SHACL engine against src/shapes/ac-shapes.ttl rather than
// hand-rolled JS checks.
