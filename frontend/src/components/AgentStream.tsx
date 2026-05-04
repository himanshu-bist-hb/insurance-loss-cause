/**
 * Agent Activity Stream - Shows live agent reasoning, tool use, and activity
 */

import { useEffect, useRef } from 'react'

export interface StreamEvent {
  timestamp: string
  agent: string
  type: 'thinking' | 'tool_use' | 'result' | 'error' | 'reasoning'
  content: string
  data?: Record<string, unknown>
}

interface AgentStreamProps {
  events: StreamEvent[]
  isProcessing: boolean
}

// SVG Icons
const ThinkingIcon = () => (
  <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

const ToolIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const ErrorIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ReasoningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const getIcon = (type: StreamEvent['type']) => {
  switch (type) {
    case 'thinking': return <ThinkingIcon />
    case 'tool_use': return <ToolIcon />
    case 'result': return <CheckIcon />
    case 'error': return <ErrorIcon />
    case 'reasoning': return <ReasoningIcon />
    default: return <ThinkingIcon />
  }
}

const getTypeColor = (type: StreamEvent['type']) => {
  switch (type) {
    case 'thinking': return 'text-amber-500 bg-amber-50 border-amber-200'
    case 'tool_use': return 'text-blue-500 bg-blue-50 border-blue-200'
    case 'result': return 'text-green-500 bg-green-50 border-green-200'
    case 'error': return 'text-red-500 bg-red-50 border-red-200'
    case 'reasoning': return 'text-purple-500 bg-purple-50 border-purple-200'
    default: return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}

const getAgentColor = (agent: string) => {
  const colors: Record<string, string> = {
    'loss_cause': 'bg-orange-100 text-orange-700',
    'structured': 'bg-blue-100 text-blue-700',
    'document': 'bg-teal-100 text-teal-700',
    'visual': 'bg-purple-100 text-purple-700',
    'adjudicator': 'bg-green-100 text-green-700',
    'pii_masking': 'bg-gray-100 text-gray-700',
  }
  return colors[agent] || 'bg-gray-100 text-gray-700'
}

const formatAgentName = (agent: string) => {
  const names: Record<string, string> = {
    'loss_cause': 'Loss Cause',
    'structured': 'Structured',
    'document': 'Document',
    'visual': 'Visual',
    'adjudicator': 'Adjudicator',
    'pii_masking': 'PII Masking',
  }
  return names[agent] || agent
}

export default function AgentStream({ events, isProcessing }: AgentStreamProps) {
  const streamEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])
  
  if (events.length === 0 && !isProcessing) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div className="text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Submit a claim to see agent activity</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Stream container */}
      <div className="flex-1 overflow-y-auto space-y-2 p-1">
        {events.map((event, index) => (
          <div 
            key={index}
            className={`rounded-lg border p-3 ${getTypeColor(event.type)} transition-all duration-300 animate-fade-in`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAgentColor(event.agent)}`}>
                {formatAgentName(event.agent)}
              </span>
              <span className="text-xs opacity-60">{event.timestamp}</span>
              <span className="ml-auto">
                {getIcon(event.type)}
              </span>
            </div>
            
            {/* Content */}
            <p className="text-sm leading-relaxed">{event.content}</p>
            
            {/* Extra data if available */}
            {event.data && Object.keys(event.data).length > 0 && (
              <div className="mt-2 p-2 bg-black bg-opacity-5 rounded text-xs font-mono overflow-x-auto">
                <pre>{JSON.stringify(event.data, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-gray-500 p-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Processing...
          </div>
        )}
        
        <div ref={streamEndRef} />
      </div>
    </div>
  )
}
