import Prism from "prismjs"
import "prismjs/components/prism-json"
import "prismjs/components/prism-turtle"

/** Highlight `code` as `language`, returning safe HTML, or null if the language isn't registered. */
export function highlight(code, language) {
  const grammar = language && Prism.languages[language]
  if (!grammar) return null
  return Prism.highlight(code, grammar, language)
}

/** Best-effort language guess from a shape resource's URL/extension. ShEx has no Prism grammar of its own — Turtle's is a reasonable approximation (shared prefix/IRI/comment syntax). */
export function languageForShapeUrl(url) {
  if (/\.(shex|ttl)([?#]|$)/i.test(url)) return "turtle"
  return null
}
