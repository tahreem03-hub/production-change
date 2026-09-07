/**
 * RejectedPlans
 *
 * Shown when status === "no_viable_plan".
 * Props:
 *   rejected – rejected[] array, each with { summary, reason }
 */
export default function RejectedPlans({ rejected }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex items-center gap-2 mb-4">
        {/* Warning icon */}
        <svg
          className="w-5 h-5 text-orange-500 flex-shrink-0"
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
        <h3 className="font-semibold text-orange-800 text-sm">
          No viable plan found
        </h3>
      </div>

      {rejected?.length > 0 ? (
        <ul className="space-y-3">
          {rejected.map((r, i) => (
            <li
              key={i}
              className="bg-white rounded-lg border border-orange-100 px-4 py-3"
            >
              {r.summary && (
                <p className="text-sm font-medium text-gray-800 mb-1">
                  {r.summary}
                </p>
              )}
              <p className="text-xs text-gray-500 leading-relaxed">
                {r.reason ?? 'No reason provided.'}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-orange-700">
          The agent could not produce a schedule that satisfies all constraints.
          Try rephrasing your request.
        </p>
      )}
    </div>
  )
}
