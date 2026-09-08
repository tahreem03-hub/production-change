import { useEffect } from 'react'

/**
 * SceneDrawer — full slide-over panel that shows complete scene details.
 * Triggered by clicking a scene strip; avoids all z-index / overflow clipping
 * issues that come with in-place tooltips.
 *
 * Props:
 *   scene    – scene object (null → closed)
 *   castMap  – { id: name }
 *   onClose  – () => void
 */
export default function SceneDrawer({ scene, castMap, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!scene) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scene, onClose])

  if (!scene) return null

  const isNight   = scene.day_night?.toUpperCase() === 'NIGHT'
  const castNames = (scene.cast_ids ?? []).map((id) => castMap[id] ?? id)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Scene ${scene.id} details`}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl
                   flex flex-col drawer-enter"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full
                ${isNight
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-amber-100 text-amber-800'}`}>
                {isNight ? <MoonIcon /> : <SunIcon />}
                {scene.day_night ?? 'Day'}
              </span>
              {scene.pages != null && (
                <span className="text-xs text-gray-400 font-medium">{scene.pages} pages</span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 leading-tight">
              Scene {scene.id}
            </h2>
            {scene.slug && (
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">{scene.slug}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-700
                       hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close panel"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Location */}
          {scene.location && (
            <Field label="Location" icon={<LocationIcon />}>
              <p className="text-sm text-gray-700">{scene.location}</p>
            </Field>
          )}

          {/* Interior / Exterior */}
          {scene.int_ext && (
            <Field label="Int / Ext" icon={<BuildingIcon />}>
              <p className="text-sm text-gray-700">{scene.int_ext}</p>
            </Field>
          )}

          {/* Description */}
          {scene.description && (
            <Field label="Description" icon={<DocIcon />}>
              <p className="text-sm text-gray-600 leading-relaxed">{scene.description}</p>
            </Field>
          )}

          {/* Cast */}
          {castNames.length > 0 && (
            <Field label="Cast" icon={<UsersIcon />}>
              <div className="flex flex-wrap gap-2 mt-1">
                {castNames.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full
                               px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    <PersonIcon />
                    {name}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {/* Pages / Hours */}
          <div className="grid grid-cols-2 gap-3">
            {scene.pages != null && (
              <Metric label="Pages" value={scene.pages} />
            )}
            {scene.estimated_hours != null && (
              <Metric label="Est. hours" value={`${scene.estimated_hours}h`} />
            )}
            {scene.budget != null && (
              <Metric label="Budget" value={fmtCurrency(scene.budget)} />
            )}
            {scene.shoot_order != null && (
              <Metric label="Shoot order" value={`#${scene.shoot_order}`} />
            )}
          </div>

          {/* Notes */}
          {scene.notes && (
            <Field label="Notes" icon={<NoteIcon />}>
              <p className="text-sm text-gray-500 leading-relaxed italic">{scene.notes}</p>
            </Field>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Click anywhere outside or press <kbd className="font-mono bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </aside>
    </>
  )
}

/* ── Small layout helpers ─────────────────────────────────────────────────── */

function Field({ label, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-gray-400 w-3.5 h-3.5 flex-shrink-0">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/* ── Icon set (inline SVG, no emoji) ─────────────────────────────────────── */

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}
function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  )
}
