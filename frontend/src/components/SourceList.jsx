import { useState } from 'react'

/**
 * SourceList — collapsible parallel search sources.
 *
 * Props:
 *   sources – [{ title, url, relevance }]
 */
export default function SourceList({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources?.length) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5
                   hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <GlobeIcon />
          <span className="text-sm font-semibold text-gray-800">Grounded in</span>
          <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </span>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          <ul className="space-y-3">
            {sources.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[10px]
                                  font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-gray-600
                               underline-offset-2 hover:underline block truncate transition-colors"
                  >
                    {s.title ?? s.url}
                  </a>
                  {s.relevance && (
                    <p className="text-xs text-gray-400 mt-0.5">{s.relevance}</p>
                  )}
                </div>
                <ExternalLinkIcon />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
