/**
 * SourceList – renders parallel_results[] as "Grounded in" sources
 *
 * Props:
 *   sources – parallel_results[], each with { title, url, relevance }
 */
export default function SourceList({ sources }) {
  if (!sources?.length) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Grounded in
      </p>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {/* External link icon */}
            <svg
              className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clipRule="evenodd"
              />
            </svg>

            <div className="flex-1 min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-800 underline-offset-2 hover:underline font-medium truncate block"
              >
                {s.title ?? s.url}
              </a>

              {s.relevance && (
                <span className="inline-block mt-0.5 text-[11px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                  {s.relevance}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
