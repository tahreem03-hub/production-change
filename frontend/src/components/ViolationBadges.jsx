import { useState } from 'react'

/**
 * ViolationBadges — collapsible, groups new vs preexisting.
 *
 * Props:
 *   violations – [{ rule, message, preexisting }]
 */
export default function ViolationBadges({ violations }) {
  const [open, setOpen] = useState(false)
  if (!violations?.length) return null

  const fresh       = violations.filter((v) => !v.preexisting)
  const preexisting = violations.filter((v) =>  v.preexisting)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5
                   hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <WarningIcon />
          <span className="text-sm font-semibold text-gray-800">Violations</span>
          {fresh.length > 0 && (
            <Chip color="red">{fresh.length} new</Chip>
          )}
          {preexisting.length > 0 && (
            <Chip color="gray">{preexisting.length} preexisting</Chip>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">
          {fresh.length > 0 && (
            <Group title="Caused by this change" accent="red">
              {fresh.map((v, i) => <Badge key={i} v={v} isNew />)}
            </Group>
          )}
          {preexisting.length > 0 && (
            <Group title="Already on the board">
              {preexisting.map((v, i) => <Badge key={i} v={v} />)}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ title, accent, children }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2.5
        ${accent === 'red' ? 'text-red-500' : 'text-gray-400'}`}>
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Badge({ v, isNew }) {
  return (
    <span
      title={v.message}
      className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl border
        ${isNew
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
        ${isNew ? 'bg-red-400' : 'bg-gray-400'}`} />
      <span className="truncate max-w-[220px]">{v.rule ?? v.message ?? 'Violation'}</span>
    </span>
  )
}

function Chip({ color, children }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
      ${color === 'red' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
      {children}
    </span>
  )
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
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
