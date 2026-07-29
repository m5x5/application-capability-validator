import { useRef } from "react"
import { highlight } from "../lib/prism"

// Must match textareaClass's box model exactly (padding/border/font/radius) so the highlight
// overlay's text lines up pixel-for-pixel with the invisible textarea text sitting on top of it.
const overlayClass =
  "whitespace-pre-wrap break-words rounded-md border border-transparent p-2.5 font-mono text-sm"

/**
 * A plain <textarea> can't be syntax-highlighted directly, so this layers a highlighted,
 * non-interactive <pre> behind a transparent-text textarea that owns all real input/caret/
 * selection/resize behavior — the textarea is the only element the user actually types into.
 * The <pre> is an in-flow sibling before the (absolutely positioned) textarea, so the
 * wrapper's height — and thus the highlight overlay's — tracks the textarea's own height,
 * including manual resizes, without a ResizeObserver.
 */
export default function CodeEditor({ id, value, onChange, language, placeholder, className }) {
  const textareaRef = useRef(null)
  const preRef = useRef(null)

  function syncScroll() {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const html = value ? highlight(value, language) : null

  return (
    <div className="relative">
      <pre
        ref={preRef}
        aria-hidden="true"
        className={`${overlayClass} pointer-events-none absolute inset-0 m-0 overflow-auto`}
      >
        {html ? <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: html }} /> : value}
        {"\n"}
      </pre>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={onChange}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck={false}
        style={{ color: "transparent" }}
        className={`${className} relative resize-y bg-transparent caret-zinc-900 dark:caret-zinc-100`}
      />
    </div>
  )
}
