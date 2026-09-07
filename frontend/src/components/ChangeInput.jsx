import { useRef } from 'react'
import AgentThinking from './AgentThinking'

const EXAMPLES = [
  'Move scene 5 to day 3',
  'Swap scenes 2 and 7',
  'Push day 4 scenes to day 5',
]

export default function ChangeInput({ onSubmit, loading }) {
  const inputRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    const text = inputRef.current?.value.trim()
    if (!text || loading) return
    onSubmit(text)
    inputRef.current.value = ''
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Input row */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
              <PencilIcon />
            </span>
            <input
              ref={inputRef}
              name="request"
              type="text"
              placeholder='Describe your change, e.g. "move scene 5 to day 3"'
              disabled={loading}
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl
                         text-sm text-gray-900 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                         disabled:bg-gray-50 disabled:cursor-not-allowed
                         transition-shadow shadow-sm"
              aria-label="Schedule change request"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3.5 bg-gray-900 text-white text-sm font-semibold
                       rounded-xl hover:bg-gray-800 active:bg-black
                       disabled:opacity-40 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
                       transition-all shadow-sm whitespace-nowrap"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Working
              </>
            ) : (
              <>
                <BoltIcon />
                Submit
              </>
            )}
          </button>
        </div>

        {/* Example prompts */}
        {!loading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.value = ex
                    inputRef.current.focus()
                  }
                }}
                className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200
                           border border-gray-200 rounded-lg px-3 py-1.5
                           transition-colors font-medium"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </form>

      <AgentThinking loading={loading} />
    </div>
  )
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}
function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
