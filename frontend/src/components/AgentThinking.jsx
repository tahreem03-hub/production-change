import { useEffect, useState } from "react"

// Create new file: src/components/AgentThinking.jsx
export default function AgentThinking({ loading }) {
  if (!loading) return null
  
  const steps = [
    "Analyzing your change request...",
    "Searching production databases via Parallel AI...",
    "Evaluating 12 alternative schedules...",
    "Calculating costs and risks...",
    "Ranking optimal solutions..."
  ]
  
  const [currentStep, setCurrentStep] = useState(0)
  
  useEffect(() => {
    if (!loading) {
      setCurrentStep(0)
      return
    }
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 800)
    return () => clearInterval(interval)
  }, [loading])
  
  return (
    <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <svg className="w-4 h-4 text-violet-500 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">Agent is processing your request</p>
          <p className="text-xs text-gray-500 mt-0.5">{steps[currentStep]}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-violet-500 h-1 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}