import { cardClass, h2Class, secondaryButtonClass, buttonClass, codeClass, tableClass, thClass, tdClass } from "../lib/ui"

export default function Discovery({ discovery, onFetch, onValidateEmbedded }) {
  if (!discovery) return null

  const { links, embedded } = discovery
  if (links.length === 0 && embedded.length === 0) return null

  return (
    <div className={cardClass}>
      <h2 className={h2Class}>Discovery</h2>

      {links.length > 0 && (
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>via</th>
              <th className={thClass}>type</th>
              <th className={thClass}>href</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l, i) => (
              <tr key={i}>
                <td className={tdClass}>{l.via}</td>
                <td className={tdClass}>
                  <code className={codeClass}>{l.type}</code>
                </td>
                <td className={tdClass}>
                  <code className={codeClass}>{l.href}</code>
                </td>
                <td className={tdClass}>
                  <button className={secondaryButtonClass} onClick={() => onFetch(l.href)}>
                    Fetch this
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {embedded.map((e) => (
        <div key={e.index} className="mt-2.5">
          <button className={buttonClass} onClick={() => onValidateEmbedded(e.doc)}>
            Validate embedded document #{e.index}
          </button>
        </div>
      ))}
    </div>
  )
}
