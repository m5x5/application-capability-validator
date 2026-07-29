export const config = { matcher: "/" }

// Minimal RFC 7231 Accept-header ranking: split, strip params other than q, sort by q desc.
function rankedAccept(header) {
  return (header || "")
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().split(";")
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      return { type: type.trim().toLowerCase(), q: qParam ? parseFloat(qParam.slice(2)) : 1 }
    })
    .filter((r) => r.type)
}

function prefersJsonLd(header) {
  const ranked = rankedAccept(header)
  if (ranked.length === 0) return false

  const jsonRank = ranked.find((r) => r.type === "application/ld+json" || r.type === "application/json")
  const htmlRank = ranked.find((r) => r.type === "text/html" || r.type === "application/xhtml+xml" || r.type === "*/*")
  if (!jsonRank) return false
  if (!htmlRank) return true
  return jsonRank.q > htmlRank.q
}

// Serves the app's own Application Capability document (#discovery) when a client
// content-negotiates for it at "/", instead of always returning the HTML shell.
export default async function middleware(request) {
  if (!prefersJsonLd(request.headers.get("accept"))) return

  const docUrl = new URL("/app-capability.jsonld", request.url)
  const res = await fetch(docUrl)
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/ld+json" },
  })
}
