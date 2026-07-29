import { useEffect, useState } from "react"
import * as Sentry from "@sentry/react"
import { Clipboard, ClipboardCheck, Code2 } from "lucide-react"
import { asArray, asNodeArray, short, groupBy, mergeCapabilitiesForDisplay, resolveUrl } from "../lib/ac"
import { validateWithShacl } from "../lib/shacl"
import { highlight, languageForShapeUrl } from "../lib/prism"
import {
  cardClass,
  h2Class,
  h3Class,
  emptyClass,
  mutedClass,
  codeClass,
  secondaryButtonClass,
  smallButtonClass,
  preClass,
  groupHeadingClass,
  groupCardClass,
  cardGridClass,
  itemCardClass,
  fieldRowClass,
  fieldLabelClass,
  fieldValueClass,
  panelWrapClass,
  panelClass,
  shapeHeadingClass,
} from "../lib/ui"
import StatusRow from "./StatusRow"

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className={fieldRowClass}>
      <div className={fieldLabelClass}>{label}:</div>
      <div className={fieldValueClass}>{value}</div>
    </div>
  )
}

/** Syntax-highlighted code block; falls back to plain (still-escaped) text when no grammar matches. */
function Code({ code, language }) {
  const html = highlight(code, language)
  if (!html) return <pre className={preClass}>{code}</pre>
  return (
    <pre className={preClass}>
      <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}

/**
 * In-flow sidebar showing either the shape(s) declared on a clicked capability, or the raw
 * document JSON. Not a modal: no backdrop, doesn't cover anything, stays put if you click
 * elsewhere — only the Close button dismisses it.
 */
function DetailPanel({ selection, onClose, onCopyRaw, copiedRaw }) {
  if (!selection) return null

  return (
    <div className={panelWrapClass}>
      <div className={panelClass}>
        <div className="flex items-start justify-between gap-2">
          {selection.kind === "raw" ? (
            <div className={groupHeadingClass}>{selection.title}</div>
          ) : (
            <div>
              <div className={groupHeadingClass}>{short(selection.cap.id || selection.cap["@id"])}</div>
              <div className={mutedClass}>{short(selection.cap.action)}</div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {selection.kind === "raw" && (
              <button className={`${smallButtonClass} flex items-center gap-1`} type="button" onClick={onCopyRaw}>
                {copiedRaw ? <ClipboardCheck size={12} /> : <Clipboard size={12} />}
                {copiedRaw ? "Copied" : "Copy"}
              </button>
            )}
            <button className={smallButtonClass} type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {selection.kind === "raw" && <Code code={selection.code} language="json" />}

        {selection.kind === "shape" &&
          (selection.shapes.length === 0 ? (
            <div className={`${emptyClass} mt-3`}>No shape declared for this capability.</div>
          ) : (
            selection.shapes.map((s, i) => (
              <div key={i} className="mt-4">
                <h3 className={shapeHeadingClass}>{s.iri}</h3>
                {s.status === "loading" && <div className={mutedClass}>Loading…</div>}
                {s.status === "error" && (
                  <div className="text-sm text-red-600 dark:text-red-500">{s.error || `HTTP ${s.httpStatus}`}</div>
                )}
                {s.status === "ok" && <Code code={s.text} language={languageForShapeUrl(s.iri)} />}
              </div>
            ))
          ))}
      </div>
    </div>
  )
}

export default function Results({ doc, baseUrl, onPanelOpenChange }) {
  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [selection, setSelection] = useState(null)
  const [hideWarnings, setHideWarnings] = useState(false)
  const [hideErrors, setHideErrors] = useState(false)

  useEffect(() => {
    onPanelOpenChange?.(!!selection)
  }, [selection, onPanelOpenChange])

  useEffect(() => {
    if (!selection) return
    function onKeyDown(e) {
      if (e.key === "Escape") setSelection(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selection])

  useEffect(() => {
    if (!doc) {
      setValidation(null)
      return
    }
    let cancelled = false
    setValidating(true)
    validateWithShacl(doc, baseUrl)
      .then((result) => {
        if (!cancelled) setValidation(result)
      })
      .catch((e) => {
        console.error("validateWithShacl crashed:", e)
        Sentry.captureException(e)
        if (!cancelled) setValidation({ conforms: false, issues: [{ level: "err", text: `Validator crashed: ${e.message}` }] })
      })
      .finally(() => {
        if (!cancelled) setValidating(false)
      })
    return () => {
      cancelled = true
    }
  }, [doc, baseUrl])

  if (!doc) return null

  const issues = validation?.issues || []
  const errCount = issues.filter((i) => i.level === "err").length
  const warnCount = issues.filter((i) => i.level === "warn").length
  const summaryLevel = errCount ? "err" : warnCount ? "warn" : "ok"
  const summaryText = errCount
    ? `${errCount} violation(s), ${warnCount} warning(s).`
    : warnCount
      ? `${warnCount} warning(s), no violations.`
      : "Conforms to the Application Capability SHACL shapes."

  const caps = asNodeArray(doc.capability)
  const reqs = asNodeArray(doc.requirement)
  const name = doc["as:name"] || doc.name || ""
  const summary = doc["as:summary"] || doc.summary || ""
  const rootId = doc.id || doc["@id"]

  function isVisible(issue) {
    if (issue.level === "ok") return false
    if (hideWarnings && issue.level === "warn") return false
    if (hideErrors && issue.level === "err") return false
    return true
  }

  // SHACL results are keyed by the original (un-merged) node IRI, so match against every id
  // a display row was built from — `ids` for a merged capability row, or the node's own id.
  function issuesFor(ids) {
    const focusNodes = new Set(asArray(ids).map((id) => resolveUrl(short(id), baseUrl)))
    return issues.filter((issue) => isVisible(issue) && focusNodes.has(issue.focusNode))
  }

  // Every id a capability/requirement card could be matched against — issues on these nodes
  // are shown inline on their card instead, so the top summary list skips them.
  const invocations = caps.flatMap((c) => asNodeArray(c.invocation))
  const claimedFocusNodes = new Set(
    [...caps, ...reqs, ...invocations].map((n) => resolveUrl(short(n.id || n["@id"]), baseUrl))
  )
  const unclaimedIssues = issues.filter((issue) => isVisible(issue) && !claimedFocusNodes.has(issue.focusNode))

  function openShapePanel(cap) {
    const shapeRefs = asArray(cap.shape)
    const shapes = shapeRefs.map((s) => ({ iri: resolveUrl(short(s), baseUrl), status: "loading" }))
    setSelection({ kind: "shape", cap, shapes })

    shapes.forEach((shapeEntry, i) => {
      fetch(shapeEntry.iri)
        .then(async (res) => {
          const text = await res.text()
          setSelection((prev) => {
            if (!prev || prev.kind !== "shape" || prev.cap !== cap) return prev
            const next = { ...prev, shapes: [...prev.shapes] }
            next.shapes[i] = { ...next.shapes[i], status: res.ok ? "ok" : "error", text, httpStatus: res.status }
            return next
          })
        })
        .catch((e) => {
          setSelection((prev) => {
            if (!prev || prev.kind !== "shape" || prev.cap !== cap) return prev
            const next = { ...prev, shapes: [...prev.shapes] }
            next.shapes[i] = { ...next.shapes[i], status: "error", error: e.message }
            return next
          })
        })
    })
  }

  function openRawPanel(node = doc, title = "Raw document") {
    setSelection({ kind: "raw", title, code: JSON.stringify(node, null, 2) })
  }

  async function handleCopyAll() {
    const report = [summaryText, ...issues.map((i) => `[${i.level}] ${i.text}`)].join("\n")
    try {
      await navigator.clipboard.writeText(report)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1200)
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  async function handleCopyRaw() {
    if (selection?.kind !== "raw") return
    try {
      await navigator.clipboard.writeText(selection.code)
      setCopiedRaw(true)
      setTimeout(() => setCopiedRaw(false), 1200)
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <div className={`mx-auto flex w-full flex-col items-start gap-4 lg:flex-row ${selection ? "" : "max-w-5xl"}`}>
      <div className="min-w-0 flex-1 space-y-4">
        <div className={cardClass}>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className={`${h2Class} mb-0`}>Validation</h2>
            {!validating && issues.length > 0 && (
              <div className="flex items-center gap-2">
                {warnCount > 0 && (
                  <button className={secondaryButtonClass} type="button" onClick={() => setHideWarnings((v) => !v)}>
                    {hideWarnings ? "Show warnings" : "Hide warnings"}
                  </button>
                )}
                {errCount > 0 && (
                  <button className={secondaryButtonClass} type="button" onClick={() => setHideErrors((v) => !v)}>
                    {hideErrors ? "Show errors" : "Hide errors"}
                  </button>
                )}
                <button className={`${secondaryButtonClass} flex items-center gap-1.5`} type="button" onClick={handleCopyAll}>
                  {copiedAll ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                  {copiedAll ? "Copied all" : "Copy all"}
                </button>
              </div>
            )}
          </div>
          {validating && <StatusRow level="warn" text="Validating…" copyable={false} />}
          {!validating && validation && (
            <>
              <StatusRow level={summaryLevel} text={summaryText} copyable={false} />
              {unclaimedIssues.map((issue, i) => (
                <StatusRow key={i} level={issue.level} text={issue.text} />
              ))}
            </>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className={`${h3Class} mt-0`}>type: Application</h3>
            <button className={`${secondaryButtonClass} flex items-center gap-1.5`} type="button" onClick={() => openRawPanel()}>
              <Code2 size={14} />
              Show code
            </button>
          </div>
          {name && (
            <div>
              <strong className="text-zinc-900 dark:text-zinc-100">{short(name)}</strong>
            </div>
          )}
          {summary && <div className={mutedClass}>{short(summary)}</div>}
          <Field label="id" value={rootId && <code className={codeClass}>{short(rootId)}</code>} />

          <h3 className={h3Class}>Capabilities</h3>
          {caps.length === 0 ? (
            <div className={emptyClass}>(none)</div>
          ) : (
            groupBy(mergeCapabilitiesForDisplay(caps), (c) => short(c.resourceType) || null).map(([resourceType, group]) => {
              const items = (
                <div className={cardGridClass}>
                  {group.map((c, i) => {
                    const capIssues = issuesFor(c.ids || c.id)
                    return (
                      <div key={i} className={`${itemCardClass} relative pr-24`}>
                        <button
                          className={`${smallButtonClass} absolute right-3 top-3 flex items-center gap-1`}
                          type="button"
                          onClick={() => openRawPanel(c, short(c.id || c["@id"]) || "Capability")}
                        >
                          <Code2 size={12} />
                          Show code
                        </button>
                        <Field label="id" value={<code className={codeClass}>{short(c.id || c["@id"])}</code>} />
                        <Field label="action" value={short(c.action)} />
                        <Field
                          label="shape"
                          value={
                            asArray(c.shape).length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span>{short(c.shape)}</span>
                                <button className={smallButtonClass} type="button" onClick={() => openShapePanel(c)}>
                                  View shape
                                </button>
                              </div>
                            ) : (
                              short(c.shape)
                            )
                          }
                        />
                        <Field label="accept / output" value={[short(c.accept), short(c.output)].filter(Boolean).join(" / ")} />
                        {asNodeArray(c.invocation).length > 0 && (
                          <div className={fieldRowClass}>
                            <div className={fieldLabelClass}>invocation:</div>
                            <div className="flex-1 space-y-1.5">
                              {asNodeArray(c.invocation).map((inv, k) => {
                                const invIssues = issuesFor(inv.id || inv["@id"])
                                return (
                                  <div key={k}>
                                    <div className={`${fieldValueClass} flex flex-wrap items-center gap-2`}>
                                      <span>{[short(inv.type), short(inv.template)].filter(Boolean).join(": ") || short(inv.id || inv["@id"])}</span>
                                      <button
                                        className={smallButtonClass}
                                        type="button"
                                        onClick={() => openRawPanel(inv, short(inv.id || inv["@id"]) || "Invocation")}
                                      >
                                        View
                                      </button>
                                    </div>
                                    {asNodeArray(inv.mapping).length > 0 && (
                                      <ul className="mt-1 ml-3 list-disc space-y-0.5">
                                        {asNodeArray(inv.mapping).map((m, mi) => (
                                          <li key={mi} className={`${fieldValueClass} font-mono`}>
                                            {short(m.variable)} <span className={mutedClass}>&larr;</span> {short(m.property)}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {invIssues.length > 0 && (
                                      <div className="mt-1.5 space-y-1.5">
                                        {invIssues.map((issue, j) => (
                                          <StatusRow key={j} level={issue.level} text={issue.text} copyable={false} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {capIssues.length > 0 && (
                          <div className="mt-1.5 space-y-1.5">
                            {capIssues.map((issue, j) => (
                              <StatusRow key={j} level={issue.level} text={issue.text} copyable={false} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )

              if (resourceType === null) return <div key="(no resourceType declared)" className="mt-3 first:mt-0">{items}</div>

              return (
                <div key={resourceType} className={groupCardClass}>
                  <div className={groupHeadingClass}>{resourceType}</div>
                  {items}
                </div>
              )
            })
          )}

          <h3 className={h3Class}>Requirements</h3>
          {reqs.length === 0 ? (
            <div className={emptyClass}>(none)</div>
          ) : (
            <div className={cardGridClass}>
              {reqs.map((r, i) => {
                const reqIssues = issuesFor(r.id || r["@id"])
                return (
                  <div key={i} className={`${itemCardClass} relative pr-24`}>
                    <button
                      className={`${smallButtonClass} absolute right-3 top-3 flex items-center gap-1`}
                      type="button"
                      onClick={() => openRawPanel(r, short(r.id || r["@id"]) || "Requirement")}
                    >
                      <Code2 size={12} />
                      Show code
                    </button>
                    <Field label="id" value={<code className={codeClass}>{short(r.id || r["@id"])}</code>} />
                    <Field label="cspDirective" value={short(r.cspDirective)} />
                    <Field label="browserPermission" value={short(r.browserPermission)} />
                    {reqIssues.length > 0 && (
                      <div className="mt-1.5 space-y-1.5">
                        {reqIssues.map((issue, j) => (
                          <StatusRow key={j} level={issue.level} text={issue.text} copyable={false} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <DetailPanel selection={selection} onClose={() => setSelection(null)} onCopyRaw={handleCopyRaw} copiedRaw={copiedRaw} />
    </div>
  )
}
