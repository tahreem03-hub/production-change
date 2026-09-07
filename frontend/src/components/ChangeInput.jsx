/**
 * ChangeInput
 *
 * Props:
 *   onSubmit  – (text: string) => void
 *   loading   – boolean
 */
import AgentThinking from './AgentThinking'

export default function ChangeInput({ onSubmit, loading }) {
  function handleSubmit(e) {
    e.preventDefault()
    const text = e.target.elements.request.value.trim()
    if (!text || loading) return
    onSubmit(text)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        name="request"
        type="text"
        placeholder="move scene 5 to day 3"
        disabled={loading}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
                   disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
        aria-label="Change request"
      />
      {loading && <AgentThinking loading={loading} />}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-violet-600 text-white px-5 py-2.5 text-sm font-medium
                   hover:bg-violet-700 active:bg-violet-800 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Thinking…
          </span>
        ) : (
          'Submit'
        )}
      </button>
    </form>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}
