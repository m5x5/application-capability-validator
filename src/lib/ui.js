// Shared Tailwind utility-class strings, kept in one place so every
// component's buttons/cards/tables/code blocks stay visually consistent.

export const cardClass = "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"

export const tabClass =
  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
  "border-zinc-200 text-zinc-500 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
export const tabActiveClass = "rounded-full border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"

export const labelClass = "mb-1 block text-sm text-zinc-500 dark:text-zinc-400"

export const inputClass =
  "rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-sm text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"

export const textareaClass =
  "min-h-[140px] w-full resize-y rounded-md border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"

export const buttonClass = "rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"

export const secondaryButtonClass =
  "rounded-md border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 " +
  "dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"

export const smallButtonClass =
  "flex-none self-start rounded-md border border-zinc-200 px-2 py-0.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 " +
  "dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"

export const footerNoteClass = "mt-2 text-sm text-zinc-500 dark:text-zinc-400"

export const linkClass = "text-blue-600 hover:underline dark:text-blue-400"

export const codeClass = "rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-800"

export const preClass =
  "overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm " +
  "dark:border-zinc-800 dark:bg-zinc-950"

export const emptyClass = "text-sm italic text-zinc-500 dark:text-zinc-400"

export const mutedClass = "text-zinc-500 dark:text-zinc-400"

export const h2Class = "mb-2.5 text-base font-semibold text-zinc-900 dark:text-zinc-100"
export const h3Class = "mb-1.5 mt-4 text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400"

export const groupCardClass =
  "mt-3 rounded-lg border border-zinc-200 bg-zinc-100/60 p-3 first:mt-0 dark:border-zinc-800 dark:bg-zinc-950/50"
export const groupHeadingClass = "mb-2 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300"

export const tableClass = "w-full border-collapse text-sm"
export const thClass = "border-b border-zinc-200 px-2 py-1.5 text-left font-semibold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
export const tdClass = "border-b border-zinc-200 px-2 py-1.5 align-top dark:border-zinc-800"

export const cardGridClass = "grid grid-cols-1 gap-2.5"
export const itemCardClass = "rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
export const fieldRowClass = "mt-1.5 flex flex-wrap items-baseline gap-x-1.5 first:mt-0"
export const fieldLabelClass = "text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400"
export const fieldValueClass = "break-words text-zinc-800 dark:text-zinc-200"

export function statusClasses(level) {
  const border =
    level === "ok"
      ? "border-green-600/40"
      : level === "warn"
        ? "border-amber-600/40"
        : "border-red-600/40"
  return `mb-1.5 flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${border}`
}

// In-flow sidebar (not a fixed/modal overlay): sits beside the main content as a flex sibling,
// sticky within the viewport once you scroll past it, never covering anything else. The Results
// row itself widens (see App.jsx) so this doesn't squeeze the main content when it opens.
export const panelWrapClass = "w-full flex-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-[720px]"
export const panelClass =
  "max-h-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
export const shapeHeadingClass = "mb-1.5 break-all font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300"

export function iconClasses(level) {
  const color = level === "ok" ? "text-green-600 dark:text-green-500" : level === "warn" ? "text-amber-600 dark:text-amber-500" : "text-red-600 dark:text-red-500"
  return `flex-none font-bold ${color}`
}
