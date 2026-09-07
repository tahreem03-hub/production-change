import { useEffect, useRef, useState } from 'react'
import { getSchedule, postChange } from './api'
import ChangeInput    from './components/ChangeInput'
import PlanCard       from './components/PlanCard'
import RejectedPlans  from './components/RejectedPlans'
import SourceList     from './components/SourceList'
import Stripboard     from './components/Stripboard'
import ViolationBadges from './components/ViolationBadges'
import { jsPDF }      from 'jspdf'

/* ── currency helper ────────────────────────────────────────────────────────── */
function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

/* ── Tabs definition ─────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'changes',  label: 'Request Change' },
  { id: 'results',  label: 'Results'  },
]

/* ═══════════════════════════════════════════════════════════════════════════════
   App
═══════════════════════════════════════════════════════════════════════════════ */
export default function App() {
  /* data */
  const [schedule,      setSchedule]      = useState(null)
  const [loadError,     setLoadError]     = useState(null)
  /* request */
  const [loading,       setLoading]       = useState(false)
  const [requestError,  setRequestError]  = useState(null)
  const [result,        setResult]        = useState(null)
  const [activePlanIdx, setActivePlanIdx] = useState(null)
  /* ui */
  const [tab,           setTab]           = useState('schedule')

  const resultsTabRef = useRef(null)

  /* Load baseline */
  useEffect(() => {
    getSchedule()
      .then(setSchedule)
      .catch((e) => setLoadError(e.message ?? 'Failed to load schedule.'))
  }, [])

  /* Derived */
  const baselineDays = schedule?.days   ?? []
  const scenes       = schedule?.scenes ?? []
  const cast         = schedule?.cast   ?? []
  const baselineCost = schedule?.baseline_cost ?? null
  const activePlan   = result?.plans?.[activePlanIdx] ?? null
  const displayDays  = activePlan?.schedule ?? baselineDays
  const violations   = activePlan?.violations ?? schedule?.violations ?? []

  const hasResults   = result !== null
  const resultCount  = result?.plans?.length ?? 0

  /* PDF export */
  async function exportPlan(plan) {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Plan ${plan.rank}: ${plan.summary}`, 20, 20)
    doc.setFontSize(11)
    if (plan.cost) doc.text(`Cost: ${fmt(plan.cost)}`, 20, 35)
    if (plan.reasoning) {
      const lines = doc.splitTextToSize(`Reasoning: ${plan.reasoning}`, 170)
      doc.text(lines, 20, 50)
    }
    if (plan.changes?.length) {
      doc.setFontSize(11)
      doc.text('Changes:', 20, 90)
      plan.changes.forEach((c, i) => {
        doc.setFontSize(10)
        const txt = doc.splitTextToSize(`${i + 1}. ${c.reason}`, 165)
        doc.text(txt, 25, 100 + i * 12)
      })
    }
    doc.save(`plan-${plan.rank}.pdf`)
  }

  /* Submit change */
  async function handleChangeRequest(text) {
    setLoading(true)
    setRequestError(null)
    setResult(null)
    setActivePlanIdx(null)

    try {
      const data = await postChange(text)
      if (data.plans?.length > 0)
        data.plans = [...data.plans].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      setActivePlanIdx(data.plans?.length > 0 ? 0 : null)
      setResult(data)
      setTab('results')
    } catch (err) {
      setRequestError(err.detail ?? err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  /* Select plan → switch to schedule tab to see stripboard */
  function handleSelectPlan(i) {
    setActivePlanIdx(i)
    setTab('schedule')
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <ClapperboardIcon />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Production Scheduler</p>
              {schedule?.production && (
                <p className="text-xs text-gray-400 mt-0.5 leading-none">
                  {schedule.production.title ?? schedule.production.name ?? ''}
                </p>
              )}
            </div>
          </div>

          {/* Stats — only when loaded */}
          {schedule && (
            <div className="hidden md:flex items-center gap-2">
              <Stat icon={<CalendarIcon />} value={baselineDays.length} label="days" />
              <Divider />
              <Stat icon={<FilmIcon />}     value={scenes.length}       label="scenes" />
              <Divider />
              <Stat icon={<UsersIcon />}    value={(schedule.cast ?? []).length} label="cast" />
              {baselineCost != null && (
                <>
                  <Divider />
                  <div className="flex items-center gap-2 bg-gray-900 text-white
                                  rounded-xl px-4 py-2 ml-1">
                    <DollarIcon />
                    <span className="text-sm font-bold">{fmt(baselineCost)}</span>
                    <span className="text-xs text-gray-400 font-normal">baseline</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Right-side pills */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {activePlan && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
                <span className="text-xs font-medium text-gray-700">
                  Plan {activePlan.rank ?? activePlanIdx + 1} active
                </span>
                <button
                  onClick={() => { setActivePlanIdx(null); setResult(null) }}
                  className="text-gray-400 hover:text-gray-700 transition-colors ml-1"
                  title="Reset to baseline"
                >
                  <XSmallIcon />
                </button>
              </div>
            )}
            {hasResults && (
              <button
                onClick={() => setTab('results')}
                className="flex items-center gap-1.5 text-xs font-semibold
                           bg-gray-900 text-white rounded-xl px-3 py-2
                           hover:bg-gray-800 transition-colors"
              >
                <SparkleIcon />
                {resultCount} plan{resultCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className="max-w-screen-xl mx-auto px-6">
          <nav className="flex gap-1" role="tablist">
            {TABS.map((t) => {
              const isActive = tab === t.id
              const showDot  = t.id === 'results' && hasResults && !isActive
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTab(t.id)}
                  ref={t.id === 'results' ? resultsTabRef : undefined}
                  className={`relative flex items-center gap-1.5 px-1 py-3 text-sm font-medium
                              transition-colors mr-6 focus:outline-none
                              ${isActive ? 'tab-active' : 'tab-inactive'}`}
                >
                  {t.label}
                  {showDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-screen-xl w-full mx-auto px-6 py-8">

        {/* Loading skeleton */}
        {!schedule && !loadError && <LoadSkeleton />}

        {/* Load error */}
        {loadError && <ErrorBanner message={loadError} />}

        {schedule && (
          <>
            {/* ── TAB: Schedule ─────────────────────────────────────────── */}
            {tab === 'schedule' && (
              <div className="space-y-6">
                <div>
                  <PageTitle>
                    {activePlan
                      ? `Stripboard — Plan ${activePlan.rank ?? activePlanIdx + 1}`
                      : 'Stripboard'}
                  </PageTitle>
                  <PageSubtitle>
                    {activePlan
                      ? 'Scenes highlighted in green have moved from the baseline.'
                      : 'Click any scene strip to see its full details.'}
                  </PageSubtitle>
                </div>

                <Stripboard
                  schedule={displayDays}
                  scenes={scenes}
                  cast={cast}
                  baseline={activePlan ? baselineDays : null}
                />

                {/* Violations surfaced here too */}
                {violations.length > 0 && (
                  <ViolationBadges violations={violations} />
                )}

                {/* Nudge to change tab if no request sent yet */}
                {!hasResults && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <PencilSquareIcon />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Want to change the schedule?</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Describe a change in plain English and the agent will propose optimised alternatives.
                      </p>
                      <button
                        onClick={() => setTab('changes')}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold
                                   text-gray-900 hover:text-gray-600 transition-colors underline-offset-2 hover:underline"
                      >
                        Request a change
                        <ArrowRightIcon />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Request Change ───────────────────────────────────── */}
            {tab === 'changes' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <PageTitle>Request a change</PageTitle>
                  <PageSubtitle>
                    Describe what you want to change in plain English. The agent will run a live
                    web search and return up to three ranked plans.
                  </PageSubtitle>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <ChangeInput onSubmit={handleChangeRequest} loading={loading} />
                  {requestError && <ErrorBanner message={requestError} className="mt-4" />}
                </div>

                {/* How it works */}
                {!loading && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      How it works
                    </p>
                    <ol className="space-y-4">
                      {HOW_IT_WORKS.map(({ icon, title, body }, i) => (
                        <li key={i} className="flex items-start gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center
                                           flex-shrink-0 text-gray-500">
                            {icon}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{title}</p>
                            <p className="text-sm text-gray-500 mt-0.5 leading-snug">{body}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Results ──────────────────────────────────────────── */}
            {tab === 'results' && (
              <div className="space-y-6">
                {/* No results yet */}
                {!hasResults && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                      <InboxIcon />
                    </div>
                    <p className="text-base font-semibold text-gray-900">No results yet</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                      Submit a change request on the previous tab to see plans here.
                    </p>
                    <button
                      onClick={() => setTab('changes')}
                      className="mt-5 inline-flex items-center gap-2 bg-gray-900 text-white
                                 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      Request a change
                      <ArrowRightIcon />
                    </button>
                  </div>
                )}

                {/* status: ok */}
                {hasResults && result.status === 'ok' && result.plans?.length > 0 && (
                  <>
                    <div>
                      <PageTitle>
                        {result.plans.length} plan{result.plans.length !== 1 ? 's' : ''} proposed
                      </PageTitle>
                      <PageSubtitle>
                        Click a plan to load it into the stripboard. Expand for full reasoning,
                        changes, and cost breakdown.
                      </PageSubtitle>
                    </div>

                    {/* Plan cards */}
                    <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
                      {result.plans.map((plan, i) => (
                        <PlanCard
                          key={i}
                          plan={plan}
                          rank={plan.rank ?? i + 1}
                          selected={activePlanIdx === i}
                          baselineCost={baselineCost}
                          onSelect={() => handleSelectPlan(i)}
                          onExport={() => exportPlan(plan)}
                          animClass={`anim-delay-${Math.min(i + 1, 3)}`}
                        />
                      ))}
                    </div>

                    {/* Compare table */}
                    {result.plans.length > 1 && (
                      <CompareTable plans={result.plans} baselineCost={baselineCost} />
                    )}

                    {/* Violations */}
                    {violations.length > 0 && (
                      <ViolationBadges violations={violations} />
                    )}

                    {/* Sources */}
                    {result.parallel_results?.length > 0 && (
                      <SourceList sources={result.parallel_results} />
                    )}
                  </>
                )}

                {/* status: no_viable_plan */}
                {hasResults && result.status === 'no_viable_plan' && (
                  <>
                    <PageTitle>No viable plan</PageTitle>
                    <RejectedPlans rejected={result.rejected} />
                    {result.parallel_results?.length > 0 && (
                      <SourceList sources={result.parallel_results} />
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-gray-700">Parallel AI</span>
          </p>
          <p className="text-xs text-gray-300 italic hidden sm:block">Every change has a price.</p>
        </div>
      </footer>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sub-components
══════════════════════════════════════════════════════════════════════════════ */

/* ── CompareTable ────────────────────────────────────────────────────────────── */
function CompareTable({ plans, baselineCost }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5
                   hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-gray-800">Compare all plans</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Cost delta</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Risk</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((plan, i) => {
                const delta = typeof plan.cost === 'number' && typeof baselineCost === 'number'
                  ? plan.cost - baselineCost : null
                return (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900 whitespace-nowrap">
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50
                                         border border-amber-200 rounded-lg px-2.5 py-0.5 text-xs font-bold">
                          <StarSmallIcon />
                          Best pick
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">Plan {plan.rank ?? i + 1}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                      <p className="truncate">{plan.summary}</p>
                    </td>
                    <td className={`px-5 py-3.5 text-right font-semibold font-mono whitespace-nowrap
                      ${delta === null ? 'text-gray-400'
                      : delta < 0 ? 'text-green-600'
                      : delta > 0 ? 'text-red-500'
                      : 'text-gray-500'}`}>
                      {delta === null ? '—'
                        : delta < 0 ? `↓ ${fmt(Math.abs(delta))}`
                        : delta > 0 ? `↑ ${fmt(Math.abs(delta))}`
                        : 'No change'}
                    </td>
                    <td className={`px-5 py-3.5 text-right font-medium
                      ${plan.risk_delta > 0 ? 'text-red-500'
                      : plan.risk_delta < 0 ? 'text-green-600'
                      : 'text-gray-400'}`}>
                      {plan.risk_delta != null
                        ? `${plan.risk_delta > 0 ? '+' : ''}${plan.risk_delta}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-600">
                      {plan.confidence != null ? `${Math.round(plan.confidence * 100)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Typography helpers ──────────────────────────────────────────────────────── */

function PageTitle({ children }) {
  return <h1 className="text-2xl font-bold text-gray-900 leading-tight">{children}</h1>
}
function PageSubtitle({ children }) {
  return <p className="text-sm text-gray-500 mt-1 leading-relaxed">{children}</p>
}

/* ── Error / skeleton ────────────────────────────────────────────────────────── */

function ErrorBanner({ message, className = '' }) {
  return (
    <div role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start
                  gap-3 text-sm text-red-700 shadow-sm ${className}`}>
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v4a1 1 0 102 0V9a1 1 0 10-2 0zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

function LoadSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-32 bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2 w-40 flex-shrink-0">
            <div className="h-14 bg-gray-300 rounded-xl" />
            <div className="h-16 bg-gray-200 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-8  bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-gray-400">Loading schedule…</p>
    </div>
  )
}

/* ── Stat pill ───────────────────────────────────────────────────────────────── */

function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-gray-400 w-4 h-4">{icon}</span>
      <span className="font-semibold text-gray-900">{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  )
}
function Divider() {
  return <span className="w-px h-4 bg-gray-200 mx-1" />
}

/* ── How it works data ───────────────────────────────────────────────────────── */

const HOW_IT_WORKS = [
  {
    icon: <SearchSmIcon />,
    title: 'Live web search',
    body:  'The agent runs real-time searches to ground its decisions in current industry data.',
  },
  {
    icon: <GridSmIcon />,
    title: 'Multiple alternatives',
    body:  'It evaluates many schedule permutations in parallel and surfaces the best three.',
  },
  {
    icon: <DollarSmIcon />,
    title: 'Cost & risk analysis',
    body:  'Each plan includes a full cost breakdown and a risk delta vs the baseline.',
  },
]

/* ── Icon set ────────────────────────────────────────────────────────────────── */

function ClapperboardIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function FilmIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function DollarIcon() {
  return (
    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function SparkleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
function XSmallIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function PencilSquareIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}
function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  )
}
function StarSmallIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}
function SearchSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
function GridSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
function DollarSmIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
