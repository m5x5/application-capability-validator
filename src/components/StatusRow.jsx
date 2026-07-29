import { useState } from "react"
import { statusClasses, iconClasses, smallButtonClass } from "../lib/ui"

const ICONS = { ok: "✓", warn: "⚠", err: "✕" }

export default function StatusRow({ level, text, copyable = true }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <div className={statusClasses(level)}>
      <span className={iconClasses(level)}>{ICONS[level]}</span>
      <span className="flex-1">{text}</span>
      {copyable && (
        <button className={smallButtonClass} type="button" onClick={handleCopy} title="Copy this message">
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  )
}
