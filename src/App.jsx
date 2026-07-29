import { useEffect, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import { Agentation } from "agentation"
import { discoverFromHtml } from "./lib/ac"
import { findCapabilityDoc } from "./lib/discover-capability"
import { parseOpenParam, setOpenParam, clearOpenParam } from "./lib/invocation"
import {
  cardClass,
  tabClass,
  tabActiveClass,
  labelClass,
  inputClass,
  textareaClass,
  buttonClass,
  secondaryButtonClass,
  linkClass,
} from "./lib/ui"
import Discovery from "./components/Discovery"
import Results from "./components/Results"
import CodeEditor from "./components/CodeEditor"

const TABS = [
  { id: "url", label: "Fetch a URL" },
  { id: "html", label: "Paste HTML" },
  { id: "json", label: "Paste capability JSON-LD" },
]

const DEFAULT_URL = `${location.origin}/app-capability.jsonld`

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  )
}

export default function App() {
  const [tab, setTab] = useState("url")
  const [url, setUrl] = useState(DEFAULT_URL)
  const [html, setHtml] = useState("")
  const [base, setBase] = useState("")
  const [json, setJson] = useState("")
  const [jsonBase, setJsonBase] = useState("")

  const [discovery, setDiscovery] = useState(null)
  const [doc, setDoc] = useState(null)
  const [baseUrl, setBaseUrl] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const lastAnalyzedUrlRef = useRef(null)

  async function fetchAndAnalyze(fetchUrl) {
    setDoc(null)
    try {
      const res = await fetch(fetchUrl)
      const text = await res.text()
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        alert(`Fetched ${fetchUrl} (HTTP ${res.status}) but it is not valid JSON:\n${e.message}`)
        return
      }
      if (!res.ok) {
        alert(`HTTP ${res.status} fetching ${fetchUrl} — showing body anyway.`)
      }
      setBaseUrl(fetchUrl)
      setDoc(parsed)
    } catch (e) {
      console.error(`fetchAndAnalyze(${fetchUrl}) failed:`, e)
      Sentry.captureException(e)
      alert(
        `Could not fetch ${fetchUrl}.\n\n` +
          "This is almost always CORS (the server didn't send Access-Control-Allow-Origin) " +
          "or the URL is unreachable from this browser. Copy the document's contents instead " +
          `and use the "Paste capability JSON-LD" tab.\n\n${e.message}`
      )
    }
  }

  async function analyzeUrl(targetUrl) {
    if (!targetUrl.trim()) return
    lastAnalyzedUrlRef.current = targetUrl
    setOpenParam(targetUrl)
    setDiscovery(null)
    setDoc(null)
    try {
      // Primary discovery per the spec (#discovery): dereference the subject URI requesting
      // application/ld+json via content negotiation. A conformant Receiver can return the
      // capability description directly, at this same URL — no out-of-band link needed.
      const res = await fetch(targetUrl, { headers: { Accept: "application/ld+json, application/json;q=0.9, text/html;q=0.8" } })
      // Use the actually-resolved URL (redirects, and browser normalization of a bare origin
      // like "https://example.org" to "https://example.org/") as the base for resolving
      // relative ids — not the raw string the user typed, which can silently disagree with it
      // (a fragment reference resolved against the two gives two different IRIs).
      const resolvedUrl = res.url || targetUrl
      const contentType = (res.headers.get("content-type") || "").toLowerCase()
      const text = await res.text()
      const trimmed = text.trim()

      const looksNegotiated = contentType.includes("json")
      if (looksNegotiated || trimmed.startsWith("{") || trimmed.startsWith("[")) {
        let parsed = null
        try {
          parsed = JSON.parse(trimmed)
        } catch {
          // not valid JSON after all — fall through to HTML discovery below
        }
        if (parsed !== null) {
          // Handles both a plain compact capability object and a server that
          // content-negotiates its whole graph as expanded JSON-LD (e.g. dokie.li itself) —
          // see discover-capability.js.
          const found = await findCapabilityDoc(parsed, resolvedUrl)
          if (found) {
            setBaseUrl(resolvedUrl)
            setDoc(found)
            return
          }
          // It really was JSON (content-negotiated or not) — say so plainly instead of
          // silently falling through to HTML-discovery, which makes no sense on JSON input.
          alert(
            `Fetched ${targetUrl}${contentType ? ` (${contentType})` : ""} and it parsed as JSON, ` +
              "but no ac:capability or ac:requirement statements were found in it — checked the top " +
              "level and, after compacting against the Application Capability context, the whole graph."
          )
          return
        }
      }

      // The server ignored content negotiation and returned HTML — fall back to scanning it
      // for a <link>/embedded description (a secondary, non-normative discovery convention).
      const found = discoverFromHtml(text, resolvedUrl)
      setDiscovery(found)
      if (found.links.length === 1 && found.embedded.length === 0) {
        fetchAndAnalyze(found.links[0].href)
      } else if (found.embedded.length === 1 && found.links.length === 0) {
        setBaseUrl(resolvedUrl)
        setDoc(found.embedded[0].doc)
      }
    } catch (e) {
      console.error(`analyzeUrl(${targetUrl}) failed:`, e)
      Sentry.captureException(e)
      alert(
        `Could not fetch ${targetUrl}.\n\n` +
          "This is almost always CORS or an unreachable URL from this browser. " +
          `View the page's source and use the "Paste HTML" tab instead.\n\n${e.message}`
      )
    }
  }

  function handleUrlFetch() {
    analyzeUrl(url)
  }

  // URI Template Invocation (#validate={validate}): load whatever URL is named in the address bar on
  // first load, and react to it changing via back/forward or the user editing the bar directly.
  useEffect(() => {
    function loadFromAddressBar() {
      const open = parseOpenParam()
      if (!open || open === lastAnalyzedUrlRef.current) return
      setUrl(open)
      setTab("url")
      analyzeUrl(open)
    }

    loadFromAddressBar()
    window.addEventListener("hashchange", loadFromAddressBar)
    window.addEventListener("popstate", loadFromAddressBar)
    return () => {
      window.removeEventListener("hashchange", loadFromAddressBar)
      window.removeEventListener("popstate", loadFromAddressBar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleHtmlAnalyze() {
    if (!html.trim()) return
    setDoc(null)
    const found = discoverFromHtml(html, base || undefined)
    setDiscovery(found)
    if (found.embedded.length === 1 && found.links.length === 0) {
      setBaseUrl(base || undefined)
      setDoc(found.embedded[0].doc)
    }
  }

  function handleJsonAnalyze() {
    setDiscovery(null)
    try {
      const parsed = JSON.parse(json)
      setBaseUrl(jsonBase || undefined)
      setDoc(parsed)
    } catch (e) {
      console.error("handleJsonAnalyze: invalid JSON pasted:", e)
      alert(`Not valid JSON: ${e.message}`)
    }
  }

  function handleReset() {
    lastAnalyzedUrlRef.current = null
    setUrl(DEFAULT_URL)
    setDiscovery(null)
    setDoc(null)
    setBaseUrl(null)
    clearOpenParam()
  }

  const narrowWrapClass = `w-full max-w-5xl ${panelOpen ? "" : "mx-auto"}`

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 p-6 text-left">
      <div className={`${narrowWrapClass} flex items-start justify-between gap-4`}>
        <div>
          <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Application Capability validator</h1>
          <div className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Paste a page's HTML (or a capability document directly) and validate it against a real{" "}
            <a className={linkClass} href="https://www.w3.org/TR/shacl/" target="_blank" rel="noopener noreferrer">
              SHACL
            </a>{" "}
            shape for the{" "}
            <a className={linkClass} href="https://dokieli.github.io/application-capability/" target="_blank" rel="noopener noreferrer">
              Application Capability
            </a>{" "}
            vocabulary. Runs entirely in your browser — nothing is sent anywhere except an optional
            same-origin/CORS-enabled fetch you trigger yourself.
          </div>
        </div>
        <a
          className={`${secondaryButtonClass} flex shrink-0 items-center gap-1.5`}
          href="https://github.com/m5x5/application-capability-validator"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon />
          GitHub
        </a>
      </div>

      <div className={`${narrowWrapClass} ${cardClass}`}>
        <div className="mb-3 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? tabActiveClass : tabClass} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "url" && (
          <div>
            <label className={labelClass} htmlFor="url-input">
              Page URL
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.org/"
                className={`${inputClass} min-w-[240px] flex-1`}
              />
              <button className={buttonClass} onClick={handleUrlFetch}>
                Fetch &amp; analyze
              </button>
              <button className={secondaryButtonClass} type="button" onClick={handleReset}>
                Reset
              </button>
            </div>
          </div>
        )}

        {tab === "html" && (
          <div>
            <label className={labelClass} htmlFor="html-input">
              HTML source
            </label>
            <textarea
              id="html-input"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<html>...</html>"
              className={textareaClass}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="m-0 flex-none text-sm text-zinc-500 dark:text-zinc-400" htmlFor="base-input">
                Base URL (to resolve relative links)
              </label>
              <input
                id="base-input"
                type="text"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="https://example.org/"
                className={`${inputClass} min-w-[200px] flex-1`}
              />
              <button className={buttonClass} onClick={handleHtmlAnalyze}>
                Analyze
              </button>
            </div>
          </div>
        )}

        {tab === "json" && (
          <div>
            <label className={labelClass} htmlFor="json-input">
              Capability document (JSON-LD)
            </label>
            <CodeEditor
              id="json-input"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{"@context": "https://www.w3.org/ns/ac.jsonld", "capability": [...]}'
              language="json"
              className={textareaClass}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="m-0 flex-none text-sm text-zinc-500 dark:text-zinc-400" htmlFor="json-base-input">
                Base URL (to resolve relative ids, e.g. "#app")
              </label>
              <input
                id="json-base-input"
                type="text"
                value={jsonBase}
                onChange={(e) => setJsonBase(e.target.value)}
                placeholder="https://example.org/"
                className={`${inputClass} min-w-[200px] flex-1`}
              />
              <button className={buttonClass} onClick={handleJsonAnalyze}>
                Validate
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={narrowWrapClass}>
        <Discovery
          discovery={discovery}
          onFetch={fetchAndAnalyze}
          onValidateEmbedded={(embeddedDoc) => {
            setBaseUrl((tab === "html" ? base : url) || undefined)
            setDoc(embeddedDoc)
          }}
        />
      </div>
      <Results doc={doc} baseUrl={baseUrl} onPanelOpenChange={setPanelOpen} />
      {import.meta.env.DEV && <Agentation />}
    </div>
  )
}
