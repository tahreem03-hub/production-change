import { useEffect, useState } from 'react'
import { getSchedule, postChange } from './api'
import ChangeInput from './components/ChangeInput'
import PlanCard from './components/PlanCard'
import RejectedPlans from './components/RejectedPlans'
import SourceList from './components/SourceList'
import Stripboard from './components/Stripboard'
import ViolationBadges from './components/ViolationBadges'

export default function App() {
  // ── Baseline schedule data ──────────────────────────────────────────────
  const [schedule, setSchedule] = useState(null)   // full /schedule response
  const [loadError, setLoadError] = useState(null)

  // ── Change‑request state ────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)
  const [result, setResult] = useState(null)        // /change response

  // ── Which plan is currently displayed on the stripboard ─────────────────
  const [activePlanIdx, setActivePlanIdx] = useState(null)

  // ── Load baseline on mount ───────────────────────────────────────────────
  useEffect(() => {
    getSchedule()
      .then(setSchedule)
      .catch((err) => setLoadError(err.message ?? 'Failed to load schedule.'))
  }, [])

  // ── Derived values ───────────────────────────────────────────────────────
  const baselineDays  = schedule?.days ?? []
  const scenes        = schedule?.scenes ?? []
  const cast          = schedule?.cast ?? []
  const baselineCost  = schedule?.baseline_cost ?? null

  // Which days to display on the stripboard right now
  const activePlan    = result?.plans?.[activePlanIdx] ?? null
  const displayDays   = activePlan?.schedule ?? baselineDays

  // Violations to show: plan's violations or baseline violations
  const violations    = activePlan?.violations ?? schedule?.violations ?? []

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleChangeRequest(text) {
    setLoading(true)
    setRequestError(null)
    setResult(null)
    setActivePlanIdx(null)

    try {
      const data = await postChange(text)
      setResult(data)

      // Auto-select the top-ranked plan if any
      if (data.plans?.length > 0) {
        // plans should already be sorted by rank from the API, but sort defensively
        const sorted = [...data.plans].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        data.plans = sorted
        setActivePlanIdx(0)
      }
    } catch (err) {
      setRequestError(err.detail ?? err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-gray-900">
              🎬 Production Scheduler
            </span>
            {schedule?.production && (
              <span className="hidden sm:block text-sm text-gray-500">
                {schedule.production.title ?? schedule.production.name ?? ''}
              </span>
            )}
          </div>

          {/* Baseline cost pill */}
          {baselineCost != null && (
            <div className="text-sm bg-gray-100 rounded-full px-3 py-1 font-mono text-gray-700">
              Schedule total:{' '}
              <span className="font-semibold">{formatCurrency(baselineCost)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Loading skeleton ────────────────────────────────────────── */}
        {!schedule && !loadError && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Spinner className="w-6 h-6 mr-2" />
            Loading schedule…
          </div>
        )}

        {/* ── Load error ──────────────────────────────────────────────── */}
        {loadError && (
          <ErrorBanner message={loadError} />
        )}

        {schedule && (
          <>
            {/* ── Stripboard ──────────────────────────────────────────── */}
            <section aria-label="Stripboard">
              <SectionHeader>
                Stripboard
                {activePlan && (
                  <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-normal">
                    Showing plan #{activePlan.rank}
                  </span>
                )}
              </SectionHeader>

              <Stripboard
                schedule={displayDays}
                scenes={scenes}
                cast={cast}
                baseline={activePlan ? baselineDays : null}
              />
            </section>

            {/* ── Baseline violations ─────────────────────────────────── */}
            {!result && schedule.violations?.length > 0 && (
              <section aria-label="Violations">
                <SectionHeader>Violations</SectionHeader>
                <ViolationBadges violations={schedule.violations} />
              </section>
            )}

            {/* ── Change input ────────────────────────────────────────── */}
            <section aria-label="Request a change">
              <SectionHeader>Request a change</SectionHeader>
              <ChangeInput onSubmit={handleChangeRequest} loading={loading} />

              {/* Inline loading note */}
              {loading && (
                <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                  <Spinner className="w-3.5 h-3.5" />
                  Running live web search — this may take a few seconds…
                </p>
              )}

              {/* Request error (422, 404, or other) */}
              {requestError && (
                <ErrorBanner message={requestError} className="mt-3" />
              )}
            </section>

            {/* ── Results ─────────────────────────────────────────────── */}
            {result && (
              <>
                {/* status: ok → plans */}
                {result.status === 'ok' && result.plans?.length > 0 && (
                  <section aria-label="Plans">
                    <SectionHeader>
                      {result.plans.length} plan
                      {result.plans.length !== 1 ? 's' : ''} proposed
                    </SectionHeader>

                    <div className="grid gap-4 md:grid-cols-3">
                      {result.plans.map((plan, i) => (
                        <PlanCard
                          key={i}
                          plan={plan}
                          rank={plan.rank ?? i + 1}
                          selected={activePlanIdx === i}
                          baselineCost={baselineCost}
                          onSelect={() => {
                            setActivePlanIdx(i)
                          }}
                        />
                      ))}
                    </div>

                    {/* Violations for active plan */}
                    {violations.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Violations
                        </p>
                        <ViolationBadges violations={violations} />
                      </div>
                    )}
                  </section>
                )}

                {/* status: no_viable_plan → rejected */}
                {result.status === 'no_viable_plan' && (
                  <section aria-label="Rejected plans">
                    <RejectedPlans rejected={result.rejected} />
                  </section>
                )}

                {/* Sources (parallel_results) */}
                {result.parallel_results?.length > 0 && (
                  <section aria-label="Sources">
                    <SourceList sources={result.parallel_results} />
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ── Small shared UI helpers ───────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
      {children}
    </h2>
  )
}

function ErrorBanner({ message, className = '' }) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2 ${className}`}
    >
      <svg
        className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9v4a1 1 0 102 0V9a1 1 0 10-2 0zm1-4a1 1 0 100 2 1 1 0 000-2z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  )
}

function Spinner({ className = 'w-4 h-4' }) {
  return (
    <svg
      className={`animate-spin text-gray-400 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
