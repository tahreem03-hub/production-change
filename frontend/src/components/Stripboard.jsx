/**
 * Stripboard
 *
 * Props:
 *   schedule   – days array from /schedule or from a selected plan
 *   scenes     – scenes array (id → slug, pages, cast_ids, day_night)
 *   cast       – cast array (id → name)
 *   baseline   – original days array (used to highlight moved scenes)
 *               pass null when rendering the baseline itself
 */
export default function Stripboard({ schedule, scenes, cast, baseline }) {
  if (!schedule?.length) return null

  // Build lookup maps
  const sceneMap = Object.fromEntries((scenes ?? []).map((s) => [s.id, s]))
  const castMap = Object.fromEntries((cast ?? []).map((c) => [c.id, c.name ?? c.id]))

  // For highlight: which scene ids moved compared to baseline?
  const movedSceneIds = new Set()
  if (baseline) {
    const baselineDay = {} // sceneId → dayNumber
    for (const day of baseline) {
      for (const sid of day.scene_ids ?? []) {
        baselineDay[sid] = day.day
      }
    }
    for (const day of schedule) {
      for (const sid of day.scene_ids ?? []) {
        if (baselineDay[sid] !== undefined && baselineDay[sid] !== day.day) {
          movedSceneIds.add(sid)
        }
      }
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-2 min-w-max">
        {schedule.map((day) => (
          <DayColumn
            key={day.day}
            day={day}
            sceneMap={sceneMap}
            castMap={castMap}
            movedSceneIds={movedSceneIds}
          />
        ))}
      </div>
    </div>
  )
}

function DayColumn({ day, sceneMap, castMap, movedSceneIds }) {
  return (
    <div className="flex flex-col gap-1 w-44 flex-shrink-0">
      {/* Column header */}
      <div className="bg-gray-800 text-white rounded-t px-2 py-1 text-xs font-semibold text-center">
        <div>Day {day.day}</div>
        <div className="font-normal opacity-75">{formatDate(day.date)}</div>
        <div className="font-normal opacity-75">{day.call_time}</div>
      </div>

      {/* Scene strips */}
      {(day.scene_ids ?? []).map((sid) => {
        const scene = sceneMap[sid]
        if (!scene) {
          return (
            <UnknownStrip key={sid} sid={sid} moved={movedSceneIds.has(sid)} />
          )
        }
        return (
          <SceneStrip
            key={sid}
            scene={scene}
            castMap={castMap}
            moved={movedSceneIds.has(sid)}
          />
        )
      })}

      {/* Footer: totals */}
      <div className="mt-auto bg-gray-100 rounded-b px-2 py-1 text-xs text-gray-500 text-center border border-gray-200">
        {day.hours != null && <span>{day.hours}h</span>}
        {day.pages != null && <span className="ml-1">· {day.pages}p</span>}
      </div>
    </div>
  )
}

function SceneStrip({ scene, castMap, moved }) {
  const isNight = scene.day_night?.toUpperCase() === 'NIGHT'

  const base = isNight
    ? 'bg-indigo-900 text-indigo-100 border-indigo-700'
    : 'bg-amber-50 text-amber-900 border-amber-300'

  const highlight = moved
    ? 'ring-2 ring-emerald-400 ring-offset-1'
    : ''

  const castNames = (scene.cast_ids ?? [])
    .map((cid) => castMap[cid] ?? cid)
    .join(', ')

  return (
    <div
      className={`rounded border px-2 py-1.5 text-xs leading-tight ${base} ${highlight}`}
      title={scene.slug}
    >
      {/* Day/Night badge + scene id */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="font-bold">Sc {scene.id}</span>
        <span
          className={`text-[10px] px-1 rounded-full font-medium ${
            isNight
              ? 'bg-indigo-700 text-indigo-200'
              : 'bg-amber-200 text-amber-800'
          }`}
        >
          {scene.day_night ?? '—'}
        </span>
      </div>

      {/* Slug */}
      <div className="truncate opacity-80">{scene.slug}</div>

      {/* Pages */}
      {scene.pages != null && (
        <div className="opacity-60 mt-0.5">{scene.pages} pg</div>
      )}

      {/* Cast */}
      {castNames && (
        <div className="truncate opacity-70 mt-0.5">{castNames}</div>
      )}

      {/* Moved indicator */}
      {moved && (
        <div className="mt-1 text-emerald-300 font-semibold text-[10px]">
          ↑ moved
        </div>
      )}
    </div>
  )
}

function UnknownStrip({ sid, moved }) {
  return (
    <div
      className={`rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs text-gray-400 ${
        moved ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      Sc {sid}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}
