/**
 * Agent status panel with subtle glass effect
 */

import { useState } from 'react'

interface AgentStatus {
  id: string
  name: string
  status: 'idle' | 'thinking' | 'processing' | 'completed' | 'error'
  message: string
  findings?: Record<string, unknown>
}

interface AgentPanelProps {
  agent: AgentStatus
}

// SVG Icons
const IdleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" strokeWidth={2} />
  </svg>
)

const ThinkingIcon = () => (
  <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 4" />
  </svg>
)

const ProcessingIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const CompletedIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
)

const ErrorIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
)

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

export default function AgentPanel({ agent }: AgentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [chatInput, setChatInput] = useState('')
  
  const statusColors = {
    idle: 'bg-gray-100 text-gray-600',
    thinking: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  }
  
  const statusIcons = {
    idle: <IdleIcon />,
    thinking: <ThinkingIcon />,
    processing: <ProcessingIcon />,
    completed: <CompletedIcon />,
    error: <ErrorIcon />,
  }
  
  const handleSendChat = () => {
    if (!chatInput.trim()) return
    
    // TODO: Send to /api/chat/{agent.id}
    console.log(`[${agent.id}] User: ${chatInput}`)
    setChatInput('')
  }
  
  return (
    <div className={`glass-panel overflow-hidden transition-all duration-200 ${
      agent.status === 'thinking' || agent.status === 'processing' 
        ? 'ring-2 ring-[var(--exl-orange)] ring-opacity-30' 
        : ''
    }`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColors[agent.status]}`}>
            {statusIcons[agent.status]}
          </span>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">{agent.name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{agent.message}</p>
          </div>
        </div>
        
        <span className={`agent-status ${agent.status}`}>
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </span>
      </div>
      
      {/* Expanded Chat Section */}
      {isExpanded && (
        <div className="border-t border-[var(--border-light)] p-4 bg-[var(--bg-tertiary)]">
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            <p className="text-sm text-[var(--text-muted)] italic">
              Ask this agent about its findings...
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder={`Ask ${agent.name}...`}
              className="flex-1 text-sm"
            />
            <button 
              onClick={handleSendChat}
              className="btn-primary px-3 py-2 text-sm flex items-center justify-center"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
