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
  const [stripboardOpen, setStripboardOpen] = useState(false)

  const resultsRef = useRef(null)

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

  /* When a plan is approved, open the stripboard to show the new schedule */
  function handleApprovePlan(idx) {
    setActivePlanIdx(idx)
    setStripboardOpen(true)
    // Scroll down to stripboard
    setTimeout(() => {
      document.getElementById('stripboard-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }

  /* PDF export — full structured report ─────────────────────────────────── */
  async function exportPlan(plan) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const PW = 210   // page width mm
    const ML = 18    // margin left
    const MR = 18    // margin right
    const TW = PW - ML - MR  // text width
    const allPlans  = result?.plans ?? []
    const prodTitle = schedule?.production?.title ?? 'NIGHT SHIFT'
    const castMap   = Object.fromEntries((schedule?.cast ?? []).map(c => [c.id, c.name]))

    // ── helpers ──────────────────────────────────────────────────────────
    let y = 0
    const LINE = 5.5
    const SECTION_GAP = 8

    function checkPage(needed = 12) {
      if (y + needed > 275) { doc.addPage(); y = 20 }
    }

    function rule(color = [229, 231, 235]) {
      doc.setDrawColor(...color)
      doc.setLineWidth(0.3)
      doc.line(ML, y, PW - MR, y)
      y += 4
    }

    function sectionHeader(title) {
      checkPage(14)
      y += 2
      doc.setFillColor(243, 244, 246)
      doc.roundedRect(ML, y - 1, TW, 7, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      doc.text(title.toUpperCase(), ML + 3, y + 4)
      y += 10
      doc.setTextColor(17, 24, 39)
    }

    function bodyText(text, indent = 0, size = 9) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(size)
      doc.setTextColor(55, 65, 81)
      const lines = doc.splitTextToSize(text, TW - indent)
      lines.forEach(line => {
        checkPage()
        doc.text(line, ML + indent, y)
        y += LINE
      })
    }

    function boldText(text, indent = 0, size = 9) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(size)
      doc.setTextColor(17, 24, 39)
      doc.text(text, ML + indent, y)
      y += LINE
    }

    function keyValue(key, value, indent = 0) {
      checkPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(107, 114, 128)
      doc.text(key + ':', ML + indent, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(17, 24, 39)
      doc.text(String(value), ML + indent + 38, y)
      y += LINE
    }

    function deltaChip(delta) {
      if (delta === null || delta === undefined) return '—'
      if (delta === 0) return 'No change'
      const abs = Math.abs(delta)
      const sign = delta < 0 ? '▼ Saves ' : '▲ Costs '
      return sign + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(abs)
    }

    // ════════════════════════════════════════════════════════════════════
    // PAGE 1 — HEADER BLOCK
    // ════════════════════════════════════════════════════════════════════
    y = 20

    // Title bar
    doc.setFillColor(17, 24, 39)
    doc.roundedRect(ML, y, TW, 22, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(255, 255, 255)
    doc.text(prodTitle, ML + 6, y + 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175)
    doc.text('Schedule Change Report', ML + 6, y + 15.5)

    // Date stamp top-right
    doc.setFontSize(7.5)
    doc.setTextColor(156, 163, 175)
    const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.text(stamp, PW - MR - doc.getTextWidth(stamp), y + 9)

    y += 28

    // Plan rank badge row
    const isBest = plan.rank === 1
    const badgeColor = isBest ? [251, 191, 36] : [209, 213, 219]
    doc.setFillColor(...badgeColor)
    doc.roundedRect(ML, y, 38, 8, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(17, 24, 39)
    doc.text(isBest ? '★  BEST PICK' : `PLAN ${plan.rank}`, ML + 4, y + 5.5)

    if (plan.confidence != null) {
      doc.setFillColor(243, 244, 246)
      doc.roundedRect(ML + 42, y, 40, 8, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      doc.text(`Confidence: ${Math.round(plan.confidence * 100)}%`, ML + 45, y + 5.5)
    }

    const delta = typeof plan.cost === 'number' && typeof baselineCost === 'number'
      ? plan.cost - baselineCost : null
    if (delta !== null) {
      const chipColor = delta < 0 ? [220, 252, 231] : delta > 0 ? [254, 226, 226] : [243, 244, 246]
      const chipText  = deltaChip(delta)
      doc.setFillColor(...chipColor)
      const chipX = PW - MR - doc.getTextWidth(chipText) - 10
      doc.roundedRect(chipX - 4, y, doc.getTextWidth(chipText) + 8, 8, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(delta < 0 ? 21 : delta > 0 ? 153 : 107, delta < 0 ? 128 : delta > 0 ? 27 : 114, delta < 0 ? 61 : delta > 0 ? 27 : 128)
      doc.text(chipText, chipX, y + 5.5)
    }

    y += 14

    // Summary headline
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(17, 24, 39)
    const summaryLines = doc.splitTextToSize(plan.summary ?? '', TW)
    summaryLines.forEach(l => { doc.text(l, ML, y); y += 6.5 })
    y += 2

    // ── SECTION: WHAT CHANGES ─────────────────────────────────────────────
    sectionHeader('What Changes')

    if (plan.changes?.length) {
      plan.changes.forEach((c, i) => {
        checkPage(10)
        // numbered bullet
        doc.setFillColor(17, 24, 39)
        doc.circle(ML + 3, y - 1.5, 2.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(255, 255, 255)
        doc.text(String(i + 1), ML + 1.8, y - 0.2)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(55, 65, 81)
        const reasonLines = doc.splitTextToSize(c.reason ?? JSON.stringify(c), TW - 10)
        reasonLines.forEach(l => {
          doc.text(l, ML + 9, y)
          y += LINE
        })
        // meta pill: from_day → to_day
        if (c.from_day != null || c.to_day != null) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.setTextColor(107, 114, 128)
          const meta = [
            c.scene_id ? `Scene ${c.scene_id}` : null,
            c.action ? c.action.toUpperCase() : null,
            c.from_day != null ? `Day ${c.from_day}` : null,
            c.to_day   != null ? `→ Day ${c.to_day}` : null,
          ].filter(Boolean).join('  ·  ')
          doc.text(meta, ML + 9, y)
          y += LINE + 1
        }
        y += 1
      })
    } else {
      bodyText('No individual scene changes recorded.')
    }

    // ── SECTION: REASONING ────────────────────────────────────────────────
    if (plan.reasoning) {
      sectionHeader('Why This Plan Was Recommended')
      checkPage(20)
      doc.setFillColor(239, 246, 255)
      const reasoningLines = doc.splitTextToSize(plan.reasoning, TW - 8)
      const blockH = reasoningLines.length * LINE + 6
      doc.roundedRect(ML, y - 2, TW, blockH, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 64, 175)
      reasoningLines.forEach(l => { doc.text(l, ML + 4, y + 2); y += LINE })
      y += 6
    }

    // ── SECTION: COST BREAKDOWN ───────────────────────────────────────────
    sectionHeader('Cost Breakdown')

    // Summary row
    checkPage(8)
    keyValue('Baseline cost', baselineCost != null ? fmt(baselineCost) : '—')
    keyValue('This plan cost', typeof plan.cost === 'number' ? fmt(plan.cost + (baselineCost ?? 0)) : '—')
    keyValue('Net delta', delta !== null ? deltaChip(delta) : '—')
    if (plan.risk_delta != null && plan.risk_delta !== 0) {
      keyValue('Risk delta', `${plan.risk_delta > 0 ? '+' : ''}${plan.risk_delta} points`)
    }
    if (plan.confidence != null) {
      keyValue('Confidence', `${Math.round(plan.confidence * 100)}%`)
    }
    y += 2

    // Line-item table
    if (plan.cost_breakdown?.lines?.length) {
      checkPage(12)
      // Table header
      doc.setFillColor(243, 244, 246)
      doc.rect(ML, y, TW, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(107, 114, 128)
      doc.text('LINE ITEM', ML + 3, y + 4.5)
      doc.text('AMOUNT', PW - MR - 3, y + 4.5, { align: 'right' })
      y += 7

      plan.cost_breakdown.lines.forEach((line, i) => {
        checkPage(7)
        if (i % 2 === 1) {
          doc.setFillColor(249, 250, 251)
          doc.rect(ML, y, TW, 6.5, 'F')
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(55, 65, 81)
        doc.text(line.label, ML + 3, y + 4.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(17, 24, 39)
        doc.text(fmt(line.amount), PW - MR - 3, y + 4.5, { align: 'right' })
        y += 6.5
      })

      // Total row
      doc.setFillColor(17, 24, 39)
      doc.rect(ML, y, TW, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(255, 255, 255)
      doc.text('Net Change', ML + 3, y + 4.8)
      doc.text(deltaChip(delta), PW - MR - 3, y + 4.8, { align: 'right' })
      y += 11
    }

    // ── SECTION: VIOLATIONS ───────────────────────────────────────────────
    const freshViolations      = (plan.violations ?? []).filter(v => !v.preexisting)
    const preexistViolations   = (plan.violations ?? []).filter(v =>  v.preexisting)

    if (plan.violations?.length) {
      sectionHeader('Rule & Constraint Violations')

      if (freshViolations.length === 0) {
        checkPage(8)
        doc.setFillColor(220, 252, 231)
        doc.roundedRect(ML, y, TW, 7, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(21, 128, 61)
        doc.text('✓  No new violations introduced by this plan', ML + 4, y + 4.8)
        y += 11
      } else {
        freshViolations.forEach(v => {
          checkPage(9)
          const sev = v.severity === 'hard'
          doc.setFillColor(sev ? 254 : 255, sev ? 226 : 251, sev ? 226 : 235)
          doc.roundedRect(ML, y, TW, 7, 1.5, 1.5, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(sev ? 153 : 161, sev ? 27 : 21, sev ? 27 : 96)
          doc.text((sev ? '✕  HARD  ' : '⚠  SOFT  ') + v.message, ML + 4, y + 4.8)
          y += 9
        })
      }

      if (preexistViolations.length) {
        y += 2
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text(`${preexistViolations.length} pre-existing violation(s) already on the baseline board (not caused by this plan).`, ML, y)
        y += LINE + 2
      }
    }

    // ── SECTION: RESULTING SCHEDULE ───────────────────────────────────────
    if (plan.schedule?.length) {
      sectionHeader('Resulting Stripboard')

      plan.schedule.forEach(day => {
        checkPage(10)
        doc.setFillColor(243, 244, 246)
        doc.roundedRect(ML, y, TW, 6.5, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(17, 24, 39)
        const dayLabel = `Day ${day.day}  —  ${day.date ?? ''}  ${day.call_time ? '  Call: ' + day.call_time : ''}`
        doc.text(dayLabel, ML + 3, y + 4.5)
        if (day.pages)  doc.text(`${day.pages} pg`, PW - MR - 22, y + 4.5)
        if (day.hours)  doc.text(`${day.hours}h`, PW - MR - 3,  y + 4.5)
        y += 8

        ;(day.scene_ids ?? []).forEach(sid => {
          checkPage(6)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(75, 85, 99)
          doc.text(`  • Sc ${sid}`, ML + 3, y)
          y += 5
        })
        y += 2
      })
    }

    // ── SECTION: WHY BETTER THAN ALTERNATIVES ────────────────────────────
    const others = allPlans.filter(p => p.rank !== plan.rank)
    if (others.length) {
      sectionHeader('Why This Plan Beats the Alternatives')

      others.forEach(other => {
        checkPage(16)
        const otherDelta = typeof other.cost === 'number' && typeof baselineCost === 'number'
          ? other.cost - baselineCost : null
        const planDelta  = delta

        doc.setFillColor(249, 250, 251)
        doc.roundedRect(ML, y, TW, 6.5, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(107, 114, 128)
        doc.text(`Plan ${other.rank}  —  ${other.summary ?? ''}`, ML + 3, y + 4.5)
        y += 8

        const comparisons = []
        if (planDelta !== null && otherDelta !== null) {
          const diff = otherDelta - planDelta
          if (diff > 0)      comparisons.push(`Costs $${Math.round(diff).toLocaleString()} more than this plan.`)
          else if (diff < 0) comparisons.push(`Costs $${Math.round(Math.abs(diff)).toLocaleString()} less — but at higher risk.`)
          else               comparisons.push('Same cost delta.')
        }
        if (plan.risk_delta != null && other.risk_delta != null && other.risk_delta > plan.risk_delta) {
          comparisons.push(`Higher risk score (+${other.risk_delta - plan.risk_delta} pts vs this plan).`)
        }
        const otherFresh = (other.violations ?? []).filter(v => !v.preexisting).length
        const thisFresh  = freshViolations.length
        if (otherFresh > thisFresh) {
          comparisons.push(`Introduces ${otherFresh - thisFresh} more violation(s).`)
        }
        if (!other.honors_request && plan.honors_request) {
          comparisons.push('Does not honour the literal request — uses an alternative day.')
        }

        if (comparisons.length === 0) comparisons.push('Similar outcome; ranked lower by composite score.')

        comparisons.forEach(txt => {
          checkPage(6)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(75, 85, 99)
          doc.text(`  → ${txt}`, ML + 3, y)
          y += 5.5
        })
        y += 4
      })
    }

    // ── SECTION: SOURCES ─────────────────────────────────────────────────
    if (plan.parallel_results?.length) {
      sectionHeader('Grounding Sources (Live Search)')
      plan.parallel_results.slice(0, 6).forEach((s, i) => {
        checkPage(8)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(17, 24, 39)
        doc.text(`${i + 1}.  ${s.title ?? s.url}`, ML, y)
        y += 4.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(99, 102, 241)
        const urlLines = doc.splitTextToSize(s.url, TW - 6)
        urlLines.forEach(l => { doc.text(l, ML + 4, y); y += 4 })
        if (s.relevance) {
          doc.setTextColor(107, 114, 128)
          doc.setFontSize(7)
          doc.text(`Relevance: ${s.relevance}`, ML + 4, y)
          y += 4
        }
        y += 2
      })
    }

    // ── FOOTER on every page ──────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.3)
      doc.line(ML, 285, PW - MR, 285)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(156, 163, 175)
      doc.text(`${prodTitle}  ·  Schedule Change Report  ·  Plan ${plan.rank}`, ML, 291)
      doc.text(`Powered by Parallel AI  ·  Page ${p} of ${pageCount}`, PW - MR, 291, { align: 'right' })
    }

    doc.save(`${prodTitle.replace(/\s+/g, '-').toLowerCase()}-plan-${plan.rank}.pdf`)
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
      // Scroll results into view after paint
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (err) {
      setRequestError(err.detail ?? err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
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

          {/* Right: active plan pill + reset */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {activePlan && (
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 w-full">

        {/* Loading skeleton */}
        {!schedule && !loadError && (
          <div className="max-w-screen-xl mx-auto px-6 py-8">
            <LoadSkeleton />
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="max-w-screen-xl mx-auto px-6 py-8">
            <ErrorBanner message={loadError} />
          </div>
        )}

        {schedule && (
          <>
            {/* ══════════════════════════════════════════════════════════════
                HERO — violations strip + input
            ══════════════════════════════════════════════════════════════ */}
            <section className="hero-section">
              <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">

                {/* Active-issues strip */}
                {violations.length > 0 && (
                  <IssuesStrip violations={violations} />
                )}

                {/* Hero headline (only before first submit) */}
                {!hasResults && !loading && (
                  <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
                      Every schedule change has a price.
                    </h1>
                    <p className="mt-2 text-base text-gray-500">
                      Describe what you want to change — the agent will find ranked alternatives
                      with cost and risk breakdowns in seconds.
                    </p>
                  </div>
                )}

                {/* Input — always visible */}
                <div className="hero-input-card">
                  <ChangeInput onSubmit={handleChangeRequest} loading={loading} />
                  {requestError && <ErrorBanner message={requestError} className="mt-4" />}
                </div>

              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                RESULTS — inline, appears after submit
            ══════════════════════════════════════════════════════════════ */}
            {hasResults && (
              <section
                ref={resultsRef}
                className="max-w-screen-xl mx-auto px-6 pb-8"
                aria-label="Plan results"
              >
                {/* status: ok */}
                {result.status === 'ok' && result.plans?.length > 0 && (
                  <div className="space-y-6 results-enter">

                    <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {result.plans.length} plan{result.plans.length !== 1 ? 's' : ''} proposed
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Click "Approve" on the best pick to load it into the stripboard below.
                        </p>
                      </div>
                      <button
                        onClick={() => { setActivePlanIdx(null); setResult(null) }}
                        className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200
                                   hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors font-medium"
                      >
                        Clear results
                      </button>
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
                          onSelect={() => setActivePlanIdx(i)}
                          onApprove={() => handleApprovePlan(i)}
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
                  </div>
                )}

                {/* status: no_viable_plan */}
                {result.status === 'no_viable_plan' && (
                  <div className="space-y-6 results-enter pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h2 className="text-xl font-bold text-gray-900">No viable plan</h2>
                      <button
                        onClick={() => { setActivePlanIdx(null); setResult(null) }}
                        className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200
                                   hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors font-medium"
                      >
                        Clear
                      </button>
                    </div>
                    <RejectedPlans rejected={result.rejected} />
                    {result.parallel_results?.length > 0 && (
                      <SourceList sources={result.parallel_results} />
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STRIPBOARD — collapsible, always present
            ══════════════════════════════════════════════════════════════ */}
            <section
              id="stripboard-section"
              className="max-w-screen-xl mx-auto px-6 pb-10"
            >
              {/* Collapse toggle header */}
              <button
                onClick={() => setStripboardOpen((v) => !v)}
                className="w-full flex items-center justify-between
                           bg-white border border-gray-200 rounded-2xl px-5 py-3.5
                           hover:bg-gray-50 transition-colors shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                aria-expanded={stripboardOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FilmIconSm />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">
                      {activePlan
                        ? `Stripboard — Plan ${activePlan.rank ?? activePlanIdx + 1} applied`
                        : 'Stripboard'}
                    </p>
                    {activePlan ? (
                      <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                        Green strips = scenes moved from baseline
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {baselineDays.length} shoot day{baselineDays.length !== 1 ? 's' : ''} · click any scene for details
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activePlan && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold
                                     text-emerald-700 bg-emerald-50 border border-emerald-200
                                     rounded-lg px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Plan {activePlan.rank ?? activePlanIdx + 1} active
                    </span>
                  )}
                  <ChevronDownIcon open={stripboardOpen} />
                </div>
              </button>

              {/* Board — slide open */}
              {stripboardOpen && (
                <div className="mt-2 stripboard-enter space-y-4">
                  <Stripboard
                    schedule={displayDays}
                    scenes={scenes}
                    cast={cast}
                    baseline={activePlan ? baselineDays : null}
                  />
                  {violations.length > 0 && (
                    <ViolationBadges violations={violations} />
                  )}
                </div>
              )}
            </section>
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
          <p className="text-xs text-gray-300 italic hidden sm:block">
            Every schedule change has a price. We tell you what it is before you commit.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Active-issues strip
══════════════════════════════════════════════════════════════════════════════ */

/**
 * A horizontal scrollable strip showing violation pills.
 * Only new (non-preexisting) violations get the warning treatment;
 * preexisting ones are shown dimmed.
 */
function IssuesStrip({ violations }) {
  const fresh       = violations.filter((v) => !v.preexisting)
  const preexisting = violations.filter((v) =>  v.preexisting)
  const all         = [...fresh, ...preexisting]

  return (
    <div className="issues-strip" role="status" aria-label="Active schedule issues">
      <div className="issues-strip-inner">
        <span className="issues-label flex-shrink-0">
          <WarningSmIcon />
          Active issues
        </span>
        <div className="issues-scroll">
          {all.map((v, i) => (
            <span
              key={i}
              title={v.message}
              className={`issues-badge ${v.preexisting ? 'issues-badge--pre' : 'issues-badge--new'}`}
            >
              {v.preexisting ? null : <span className="issues-dot" />}
              <span className="truncate max-w-[200px]">
                {v.rule ?? v.message ?? 'Violation'}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   CompareTable (inline)
══════════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════════════════════
   Error / skeleton
══════════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════════════════════
   Icon set
══════════════════════════════════════════════════════════════════════════════ */

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
function FilmIconSm() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
function XSmallIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
function ChevronDownIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
function WarningSmIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}
