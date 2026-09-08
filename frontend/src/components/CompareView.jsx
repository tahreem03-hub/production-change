export default function CompareView({ plans, baselineCost }) {
  if (!plans?.length) return null

  // Find the plan with violations
  const getViolationsCount = (plan) => {
    return plan?.violations?.length || 0
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Metric
            </th>
            <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Baseline
            </th>
            {plans.map((p, i) => (
              <th key={i} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Plan #{p.rank || i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Total Cost Row */}
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="p-3 text-gray-600 font-medium">Total Cost</td>
            <td className="p-3 font-mono font-semibold text-gray-900">
              ${baselineCost?.toLocaleString() || '0'}
            </td>
            {plans.map((p, i) => {
              const isSaving = p.cost < baselineCost
              return (
                <td key={i} className={`p-3 font-mono font-semibold ${isSaving ? 'text-green-600' : 'text-red-600'}`}>
                  ${p.cost?.toLocaleString() || '0'}
                  {isSaving && <span className="ml-1 text-xs text-green-500">↓</span>}
                </td>
              )
            })}
          </tr>

          {/* Savings Row */}
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="p-3 text-gray-600 font-medium">Savings vs Baseline</td>
            <td className="p-3 text-gray-400 font-mono">—</td>
            {plans.map((p, i) => {
              const delta = p.cost - baselineCost
              const isSaving = delta < 0
              return (
                <td key={i} className={`p-3 font-mono font-semibold ${isSaving ? 'text-green-600' : 'text-red-600'}`}>
                  {isSaving ? '-' : '+'}${Math.abs(delta).toLocaleString()}
                </td>
              )
            })}
          </tr>

          {/* Violations Row */}
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="p-3 text-gray-600 font-medium">Violations</td>
            <td className="p-3 font-mono">{getViolationsCount({ violations: [] })}</td>
            {plans.map((p, i) => (
              <td key={i} className="p-3 font-mono">
                {getViolationsCount(p)}
              </td>
            ))}
          </tr>

          {/* Risk Delta Row */}
          {plans.some(p => p.risk_delta != null) && (
            <tr className="hover:bg-gray-50">
              <td className="p-3 text-gray-600 font-medium">Risk Delta</td>
              <td className="p-3 font-mono text-gray-400">—</td>
              {plans.map((p, i) => (
                <td key={i} className={`p-3 font-mono font-semibold ${p.risk_delta < 0 ? 'text-green-600' : p.risk_delta > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {p.risk_delta != null ? (p.risk_delta > 0 ? '+' : '') + p.risk_delta : '—'}
                </td>
              ))}
            </tr>
          )}

          {/* Changes Count Row */}
          <tr className="hover:bg-gray-50">
            <td className="p-3 text-gray-600 font-medium">Changes</td>
            <td className="p-3 font-mono text-gray-400">—</td>
            {plans.map((p, i) => (
              <td key={i} className="p-3 font-mono">
                {p.changes?.length || 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}