import { useState } from 'react'
import SceneDrawer from './SceneDrawer'

/**
 * Stripboard
 *
 * Props:
 *   schedule   – days array
 *   scenes     – scenes array
 *   cast       – cast array
 *   baseline   – original days array (null when viewing baseline)
 */
export default function Stripboard({ schedule, scenes, cast, baseline }) {
  const [activeScene, setActiveScene] = useState(null)

  if (!schedule?.length) return null

  const sceneMap = Object.fromEntries((scenes ?? []).map((s) => [s.id, s]))
  const castMap  = Object.fromEntries((cast  ?? []).map((c) => [c.id, c.name ?? c.id]))

  // Compute moved scene ids
  const movedIds = new Set()
  if (baseline) {
    const baselineDay = {}
    for (const day of baseline)
      for (const sid of day.scene_ids ?? []) baselineDay[sid] = day.day
    for (const day of schedule)
      for (const sid of day.scene_ids ?? [])
        if (baselineDay[sid] !== undefined && baselineDay[sid] !== day.day)
          movedIds.add(sid)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Legend */}
        <div className="flex items-center gap-5 px-5 py-2.5 border-b border-gray-100 bg-gray-50/70">
          <LegendItem color="bg-amber-400" label="Day" />
          <LegendItem color="bg-slate-700" label="Night" />
          {movedIds.size > 0 && (
            <LegendItem color="bg-emerald-400" label={`${movedIds.size} moved`} pulse />
          )}
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400 select-none">
            <ChevronLeftIcon />
            <span>scroll</span>
            <ChevronRightIcon />
          </div>
        </div>

        {/* Board */}
        <div className="overflow-x-auto board-scroll px-4 py-4">
          <div className="flex gap-3 min-w-max">
            {schedule.map((day) => (
              <DayColumn
                key={day.day}
                day={day}
                sceneMap={sceneMap}
                castMap={castMap}
                movedIds={movedIds}
                onSceneClick={(scene) => setActiveScene(scene)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scene detail drawer — rendered in document root via portal-like positioning */}
      <SceneDrawer
        scene={activeScene}
        castMap={castMap}
        onClose={() => setActiveScene(null)}
      />
    </>
  )
}

/* ── Day column ─────────────────────────────────────────────────────────────── */

function DayColumn({ day, sceneMap, castMap, movedIds, onSceneClick }) {
  const totalPages = (day.scene_ids ?? [])
    .reduce((sum, sid) => sum + (sceneMap[sid]?.pages ?? 0), 0)

  return (
    <div className="flex flex-col w-44 flex-shrink-0">
      {/* Header */}
      <div className="rounded-t-xl bg-gray-900 text-white px-3 py-2.5 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">Day</p>
        <p className="text-2xl font-bold leading-none mt-0.5">{day.day}</p>
        <p className="text-[11px] text-gray-400 mt-1">{formatDate(day.date)}</p>
        {day.call_time && (
          <p className="text-[10px] text-gray-500 mt-0.5">Call {day.call_time}</p>
        )}
      </div>

      {/* Strips */}
      <div className="flex flex-col gap-1.5 py-2 px-1 flex-1">
        {(day.scene_ids ?? []).map((sid) => {
          const scene = sceneMap[sid]
          return scene ? (
            <SceneStrip
              key={sid}
              scene={scene}
              castMap={castMap}
              moved={movedIds.has(sid)}
              onClick={() => onSceneClick(scene)}
            />
          ) : (
            <UnknownStrip key={sid} sid={sid} moved={movedIds.has(sid)} />
          )
        })}
      </div>

      {/* Footer */}
      <div className="rounded-b-xl border border-t-0 border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex justify-between text-[11px] text-gray-400 font-medium">
          <span>{day.hours != null ? `${day.hours}h` : ''}</span>
          <span>{totalPages > 0 ? `${totalPages} pg` : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Scene strip ────────────────────────────────────────────────────────────── */

function SceneStrip({ scene, castMap, moved, onClick }) {
  const isNight = scene.day_night?.toUpperCase() === 'NIGHT'

  const castNames = (scene.cast_ids ?? []).map((id) => castMap[id] ?? id)
  const initials  = castNames
    .map((n) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase())

  const bg = isNight
    ? 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
    : 'bg-amber-50  text-amber-900 border-amber-200 hover:bg-amber-100'

  const movedRing = moved ? 'scene-moved ring-2 ring-emerald-400 ring-offset-1' : ''

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click for full scene details"
      className={`w-full text-left rounded-lg border px-2.5 py-2 cursor-pointer
                  transition-all duration-150 active:scale-95 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-violet-400
                  ${bg} ${movedRing}`}
    >
      {/* Row 1: ID + day/night indicator */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] font-bold tracking-tight">Sc {scene.id}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0
          ${isNight ? 'bg-slate-400' : 'bg-amber-400'}`}
          aria-label={scene.day_night ?? 'Day'}
        />
      </div>

      {/* Row 2: Slug (truncated) */}
      <p className="text-[10px] leading-tight truncate opacity-70 mb-1.5">
        {scene.slug ?? '—'}
      </p>

      {/* Row 3: Pages + cast avatars */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] opacity-50 font-medium">
          {scene.pages != null ? `${scene.pages}p` : ''}
        </span>
        <div className="flex -space-x-1">
          {initials.slice(0, 3).map((init, i) => (
            <Avatar key={i} initials={init} night={isNight} />
          ))}
          {initials.length > 3 && (
            <Avatar initials={`+${initials.length - 3}`} night={isNight} />
          )}
        </div>
      </div>

      {/* Moved chip */}
      {moved && (
        <span className="absolute -top-1.5 -right-1 bg-emerald-500 text-white
                         text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          moved
        </span>
      )}
    </button>
  )
}

function Avatar({ initials, night }) {
  return (
    <span className={`w-4 h-4 rounded-full text-[8px] font-bold
                      flex items-center justify-center border select-none
                      ${night
                        ? 'bg-slate-600 text-slate-100 border-slate-700'
                        : 'bg-amber-200 text-amber-800 border-amber-300'}`}>
      {initials}
    </span>
  )
}

function UnknownStrip({ sid, moved }) {
  return (
    <div className={`rounded-lg border border-dashed border-gray-300 bg-gray-50
                     px-2.5 py-2 text-[10px] text-gray-400
                     ${moved ? 'ring-2 ring-emerald-400 scene-moved' : ''}`}>
      Sc {sid}
    </div>
  )
}

function LegendItem({ color, label, pulse }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${color} ${pulse ? 'step-active' : ''}`} />
      {label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return d }
}

function ChevronLeftIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}
function ChevronRightIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
