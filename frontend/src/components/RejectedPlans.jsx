/**
 * RejectedPlans — shown when status === "no_viable_plan".
 *
 * Props:
 *   rejected – [{ summary, reason }]
 */
export default function RejectedPlans({ rejected }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-amber-100 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <WarningIcon />
        </div>
        <div>
          <h3 className="text-base font-semibold text-amber-900">No viable plan found</h3>
          <p className="text-sm text-amber-700 mt-0.5 leading-snug">
            The agent explored alternatives but none satisfied all constraints.
            Try rephrasing or relaxing the constraints.
          </p>
        </div>
      </div>

      {/* Rejected items */}
      {rejected?.length > 0 && (
        <ul className="divide-y divide-amber-100">
          {rejected.map((r, i) => (
            <li key={i} className="px-6 py-4 flex items-start gap-4 bg-white/60">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold
                                flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                {r.summary && (
                  <p className="text-sm font-semibold text-gray-900 mb-1">{r.summary}</p>
                )}
                <p className="text-sm text-gray-500 leading-relaxed">{r.reason ?? 'No reason provided.'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Tip */}
      <div className="px-6 py-3.5 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
        <LightbulbIcon />
        <p className="text-xs text-amber-700">
          Tip: be specific — e.g. "move scene 5 to day 3 if day 3 has fewer than 6 pages"
        </p>
      </div>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}
function LightbulbIcon() {
  return (
    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}
