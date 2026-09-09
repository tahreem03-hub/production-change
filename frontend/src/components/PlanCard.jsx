import { useState } from 'react'

/**
 * PlanCard
 *
 * Props:
 *   plan         – plan object
 *   rank         – 1-based display rank
 *   selected     – boolean
 *   baselineCost – number
 *   onSelect     – () => void  (loads plan into stripboard)
 *   onExport     – () => void
 *   animClass    – optional extra class for stagger animation
 */
export default function PlanCard({ plan, rank, selected, baselineCost, onSelect, onApprove, onExport, animClass = '' }) {
  const [open, setOpen] = useState(false)

  const delta    = (typeof plan.cost === 'number' && typeof baselineCost === 'number')
    ? plan.cost - baselineCost : null
  const saving   = delta !== null && delta < 0
  const costly   = delta !== null && delta > 0
  const isBest   = rank === 1

  return (
    <article
      className={`rounded-2xl border bg-white shadow-sm transition-all duration-200 anim-fade-up ${animClass}
        ${selected
          ? 'border-gray-900 shadow-md ring-1 ring-gray-900'
          : isBest
          ? 'border-amber-300 hover:border-gray-400'
          : 'border-gray-200 hover:border-gray-400'
        }`}
    >
      {/* ── Clickable summary row ────────────────────────────────────── */}
      <div
        className="px-5 pt-5 pb-4 cursor-pointer select-none"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        aria-pressed={selected}
      >
        {/* Top: rank + badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg
            ${isBest
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-gray-100 text-gray-600'
            }`}>
            {isBest ? 'Best pick' : `Plan ${rank}`}
          </span>

          {selected && (
            <span className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg font-medium">
              Active
            </span>
          )}

          {delta !== null && (
            <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg
              ${saving ? 'bg-green-100 text-green-700'
              : costly ? 'bg-red-100  text-red-600'
              :          'bg-gray-100 text-gray-600'}`}>
              {saving ? `↓ Saves ${fmt(Math.abs(delta))}`
              : costly ? `↑ Costs ${fmt(Math.abs(delta))}`
              :          'No cost change'}
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="text-base font-semibold text-gray-900 leading-snug">{plan.summary}</p>

        {/* Sub-metrics row */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {plan.risk_delta != null && plan.risk_delta !== 0 && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium
              ${plan.risk_delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
              <TrendIcon up={plan.risk_delta > 0} />
              Risk {plan.risk_delta > 0 ? '+' : ''}{plan.risk_delta}
            </span>
          )}

          {plan.confidence != null && (
            <div className="flex items-center gap-2 flex-1 min-w-[120px]">
              <span className="text-xs text-gray-400 whitespace-nowrap">Confidence</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-800 rounded-full transition-all duration-700"
                  style={{ width: `${Math.round(plan.confidence * 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-gray-500">
                {Math.round(plan.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 flex items-center gap-2 border-t border-gray-100 pt-3 flex-wrap">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900
                     font-medium transition-colors"
        >
          <ChevronIcon open={open} />
          {open ? 'Hide details' : 'Show details'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {onApprove && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove() }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                         transition-colors
                         ${isBest
                           ? 'bg-gray-900 text-white hover:bg-gray-700'
                           : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
              title="Load this plan into the stripboard"
            >
              <CheckSmIcon />
              Approve
            </button>
          )}

          {onExport && (
            <button
              onClick={(e) => { e.stopPropagation(); onExport() }}
              className="flex items-center gap-1.5 text-xs text-gray-400
                         hover:text-gray-700 border border-gray-200 hover:border-gray-300
                         px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <DownloadIcon />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Expandable detail panel ──────────────────────────────────── */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-5">

          {/* Reasoning */}
          {plan.reasoning && (
            <div>
              <SectionLabel>Reasoning</SectionLabel>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2">
                <p className="text-sm text-blue-800 leading-relaxed">{plan.reasoning}</p>
              </div>
            </div>
          )}

          {/* Strategy */}
          {plan.strategy && (
            <div>
              <SectionLabel>Strategy</SectionLabel>
              <span className="inline-block mt-1.5 text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg border border-gray-200 capitalize">
                {plan.strategy.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Changes */}
          {plan.changes?.length > 0 && (
            <div>
              <SectionLabel>Changes</SectionLabel>
              <ul className="mt-2 space-y-2">
                {plan.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-gray-900 text-white
                                     text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-snug">
                      {c.reason ?? JSON.stringify(c)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cost breakdown */}
          {plan.cost_breakdown?.lines?.length > 0 && (
            <div>
              <SectionLabel>Cost breakdown</SectionLabel>
              <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {plan.cost_breakdown.lines.map((line, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                        <td className="px-4 py-2.5 text-gray-600">{line.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                          {typeof line.amount === 'number' ? fmt(line.amount) : line.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sources within plan */}
          {plan.parallel_results?.length > 0 && (
            <div>
              <SectionLabel>Sources</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.parallel_results.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600
                               hover:text-gray-900 bg-gray-100 hover:bg-gray-200
                               border border-gray-200 rounded-lg px-3 py-1.5 transition-colors font-medium"
                  >
                    <ExternalLinkIcon />
                    {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</p>
  )
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function TrendIcon({ up }) {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d={up ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}
function CheckSmIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
