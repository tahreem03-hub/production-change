/**
 * AgentTrace - Displays the agent's chain of thought
 * Shows step-by-step reasoning from the backend
 */
export default function AgentTrace({ steps }) {
  if (!steps?.length) return null

  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-xs font-mono text-green-400 font-semibold tracking-wide">
          Agent Chain of Thought
        </span>
        <span className="text-[10px] text-gray-500 ml-auto">
          {steps.length} steps
        </span>
      </div>
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 text-xs font-mono">
            <span className="text-gray-600 w-6 flex-shrink-0 text-right">
              {String(i + 1).padStart(2, '0')}.
            </span>
            <span 
              className={i === steps.length - 1 ? 'text-green-400' : 'text-gray-300'}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <span className="text-gray-700">→</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-800">
        <span className="text-[10px] text-gray-500">
          Agent processed in real-time using Parallel Search
        </span>
      </div>
    </div>
  )
}