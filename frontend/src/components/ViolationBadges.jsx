/**
 * ViolationBadges
 *
 * Props:
 *   violations – violations[] array, each with { rule, message, preexisting }
 */
export default function ViolationBadges({ violations }) {
  if (!violations?.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {violations.map((v, i) => {
        const isPreexisting = v.preexisting === true

        return (
          <span
            key={i}
            title={v.message}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              isPreexisting
                ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-60'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {/* Icon */}
            <svg
              className={`w-3 h-3 flex-shrink-0 ${
                isPreexisting ? 'text-gray-400' : 'text-red-500'
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>

            {/* Label */}
            <span className="truncate max-w-[220px]">
              {v.rule ?? v.message ?? 'Violation'}
            </span>

            {/* Preexisting label */}
            {isPreexisting && (
              <span className="italic text-[10px] text-gray-400 whitespace-nowrap">
                already on the board
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
