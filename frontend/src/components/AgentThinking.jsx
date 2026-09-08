import { useEffect, useState } from 'react'

const STEPS = [
  { label: 'Parsing request',               icon: <EditIcon /> },
  { label: 'Live web search via Parallel',  icon: <SearchIcon /> },
  { label: 'Evaluating alternatives',       icon: <GridIcon /> },
  { label: 'Calculating costs and risks',   icon: <ChartIcon /> },
  { label: 'Ranking solutions',             icon: <StarIcon /> },
]

export default function AgentThinking({ loading }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!loading) { setStep(0); return }
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900)
    return () => clearInterval(id)
  }, [loading])

  if (!loading) return null

  return (
    <div className="mt-4 border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* Bar header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SpinnerIcon />
          <span className="text-sm font-semibold text-gray-800">Agent working</span>
        </div>
        <span className="text-xs text-gray-400">Live search active — may take a few seconds</span>
      </div>

      {/* Steps */}
      <div className="px-5 py-4">
        <ol className="relative">
          {STEPS.map((s, i) => {
            const done    = i < step
            const active  = i === step
            const pending = i > step
            return (
              <li key={i} className="flex items-start gap-4 pb-4 last:pb-0 relative">
                {/* Connector */}
                {i < STEPS.length - 1 && (
                  <span className={`absolute left-[15px] top-8 w-px h-full transition-colors duration-500
                    ${done ? 'bg-gray-900' : 'bg-gray-200'}`} />
                )}

                {/* Dot */}
                <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center
                  flex-shrink-0 border-2 transition-all duration-400
                  ${done    ? 'bg-gray-900 border-gray-900 text-white'
                  : active  ? 'bg-white border-gray-900 text-gray-900 step-active'
                  : 'bg-white border-gray-200 text-gray-300'}`}>
                  {done
                    ? <CheckIcon />
                    : <span className="w-3.5 h-3.5">{s.icon}</span>
                  }
                </span>

                {/* Label */}
                <div className="pt-1.5 min-w-0">
                  <p className={`text-sm transition-colors duration-300 leading-snug
                    ${done    ? 'text-gray-400 line-through decoration-gray-300'
                    : active  ? 'text-gray-900 font-semibold'
                    : 'text-gray-400'}`}>
                    {s.label}
                  </p>
                  {active && (
                    <div className="flex gap-1 mt-2">
                      {[0, 1, 2].map((j) => (
                        <span
                          key={j}
                          className="w-1 h-1 rounded-full bg-gray-900 animate-bounce"
                          style={{ animationDelay: `${j * 120}ms` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gray-900 transition-all duration-700 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 text-gray-700 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}
