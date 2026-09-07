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
export default function PlanCard({ plan, rank, selected, baselineCost, onSelect }) {
  const delta = typeof plan.cost === 'number' && typeof baselineCost === 'number'
    ? plan.cost - baselineCost
    : null

  const isSaving = delta !== null && delta < 0
  const isExpensive = delta !== null && delta > 0

  return (
    <div
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
        selected
          ? 'border-violet-500 bg-violet-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md'
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-pressed={selected}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            #{rank}
          </span>
          <h3 className="text-sm font-semibold text-gray-800 leading-snug">
            {plan.summary}
          </h3>
        </div>
        {selected && (
          <span className="text-[10px] bg-violet-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
            Active
          </span>
        )}
      </div>

      {/* Cost delta */}
      {delta !== null && (
        <div
          className={`inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded mb-3 ${
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

      {/* Risk delta */}
      {plan.risk_delta != null && (
        <div className="text-xs text-gray-500 mb-3">
          Risk Δ:{' '}
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
            Cost breakdown
          </p>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {plan.cost_breakdown.lines.map((line, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-0.5 px-1 text-gray-600">{line.label}</td>
                  <td className="py-0.5 px-1 text-right font-mono text-gray-800">
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
