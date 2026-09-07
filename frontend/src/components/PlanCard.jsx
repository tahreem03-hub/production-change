/**
 * PlanCard
 *
 * Props:
 *   plan          – a single plan object from plans[]
 *   rank          – display rank (1-based)
 *   selected      – boolean, true when this plan's stripboard is active
 *   baselineCost  – number, used to compute cost delta
 *   onSelect      – () => void
 */
import { useState } from 'react'

export default function PlanCard({ plan, rank, selected, baselineCost, onSelect }) {
  const [expanded, setExpanded] = useState(selected)
  const delta = typeof plan.cost === 'number' && typeof baselineCost === 'number'
    ? plan.cost - baselineCost
    : null

  const isSaving = delta !== null && delta < 0
  const isExpensive = delta !== null && delta > 0

  const toggleExpand = (e) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        selected
          ? 'border-violet-500 bg-violet-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md'
      }`}
    >
      {/* Clickable header */}
      <div
        className="p-4 cursor-pointer"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        aria-pressed={selected}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
              #{rank}
            </span>
            <h3 className="text-sm font-semibold text-gray-800 leading-snug truncate">
              {plan.summary}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selected && (
              <span className="text-[10px] bg-violet-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                Active
              </span>
            )}
            <button
              onClick={toggleExpand}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cost delta - always visible */}
        {delta !== null && (
          <div
            className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded mt-2 ${
              isSaving
                ? 'bg-green-100 text-green-700'
                : isExpensive
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isSaving && '↓ saves '}
            {isExpensive && '↑ costs '}
            {delta === 0 && 'No cost change '}
            {delta !== 0 && formatCurrency(Math.abs(delta))}
          </div>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          {/* Risk delta */}
          {plan.risk_delta != null && (
            <div className="text-xs text-gray-500 mb-3 mt-3">
              Risk Delta:{' '}
              <span
                className={
                  plan.risk_delta > 0
                    ? 'text-red-500 font-medium'
                    : plan.risk_delta < 0
                    ? 'text-green-600 font-medium'
                    : 'text-gray-500'
                }
              >
                {plan.risk_delta > 0 ? '+' : ''}
                {plan.risk_delta}
              </span>
            </div>
          )}

          {/* Changes list */}
          {plan.changes?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Changes
              </p>
              <ul className="space-y-0.5">
                {plan.changes.map((change, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                    <span className="text-violet-400 mt-0.5">•</span>
                    <span>{change.reason ?? JSON.stringify(change)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cost breakdown table */}
          {plan.cost_breakdown?.lines?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Cost Breakdown
              </p>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {plan.cost_breakdown.lines.map((line, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="py-0.5 px-2 text-gray-600">{line.label}</td>
                      <td className="py-0.5 px-2 text-right font-mono text-gray-800">
                        {typeof line.amount === 'number'
                          ? formatCurrency(line.amount)
                          : line.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Parallel sources - inside each plan */}
          {plan.parallel_results?.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {plan.parallel_results.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-violet-600 hover:text-violet-800 underline"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}