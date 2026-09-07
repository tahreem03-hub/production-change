export default function SourceList({ sources }) {
  if (!sources?.length) return null
  
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Grounded in Parallel Search
      </h4>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span className="font-medium">{source.title}</span>
            {source.relevance && (
              <span className="text-gray-400 text-[10px]">({source.relevance})</span>
            )}
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}