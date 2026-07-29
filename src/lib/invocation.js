// URI Template Invocation (https://dokieli.github.io/application-capability/#uri-template-invocation)
// for this validator itself: template "#validate={validate}" — the Consumer expands it with the URL to
// validate, so the link being checked is always visible/bookmarkable/shareable in the address bar,
// and reloading or following a shared link re-runs the same validation.

export const OPEN_INVOCATION_TEMPLATE = "#validate={validate}"

/** Read the `validate` invocation variable out of a URL fragment (defaults to the current page's). */
export function parseOpenParam(hash = window.location.hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  if (!raw) return null
  return new URLSearchParams(raw).get("validate")
}

/**
 * Expand the invocation template with `url` and reflect it in the address bar without
 * reloading the page or polluting history with one entry per keystroke/fetch.
 */
export function setOpenParam(url) {
  const next = `#validate=${encodeURIComponent(url)}`
  if (window.location.hash !== next) {
    window.history.pushState(null, "", next)
  }
}

/** Remove the `validate` invocation variable from the address bar. */
export function clearOpenParam() {
  if (window.location.hash) {
    window.history.pushState(null, "", window.location.pathname + window.location.search)
  }
}
