/**
 * Agents Processing Page — Light Theme, Flow Layout
 * 3 sections: Loss Cause Agent | Adjudicator (with flow) | Analysis Results
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { API_BASE_URL } from '../config'

/* ── Typewriter hook: smooth char-by-char reveal for batched text ── */
function useTypewriter(text: string, charsPerMs = 0.15): string {
  // Initialize to full length so historical/static text shows instantly
  const [displayLen, setDisplayLen] = useState(text.length)
  const displayLenRef = useRef(text.length)
  const rafRef = useRef(0)
  const prevTimeRef = useRef(0)

  useEffect(() => {
    // Text shrank (new claim / reset) → snap to full
    if (text.length < displayLenRef.current) {
      displayLenRef.current = text.length
      setDisplayLen(text.length)
      return
    }
    // Already caught up
    if (displayLenRef.current >= text.length) return

    const tick = (now: number) => {
      if (!prevTimeRef.current) prevTimeRef.current = now
      const dt = now - prevTimeRef.current
      prevTimeRef.current = now

      const cur = displayLenRef.current
      const target = text.length
      if (cur < target) {
        const behind = target - cur
        // Adaptive speed: faster when further behind (prevents lag buildup)
        const speed = charsPerMs * (1 + behind / 200)
        const advance = Math.max(1, Math.round(dt * speed))
        const next = Math.min(cur + advance, target)
        displayLenRef.current = next
        setDisplayLen(next)
      }
      if (displayLenRef.current < text.length) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    prevTimeRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text, charsPerMs])

  return text.slice(0, displayLen)
}

/* ── Types ── */
interface AgentEvent {
  timestamp: string
  agent: string
  type: 'thinking' | 'tool_use' | 'result' | 'error' | 'reasoning'
  content: string
  data?: Record<string, unknown>
}

interface Verdict {
  fraud_probability: number
  fraud_verdict: 'AUTO APPROVE' | 'MANUAL REVIEW' | 'SIU' | 'APPROVE' | 'FLAG' | 'REJECT'
  loss_cause_primary: string
  loss_cause_secondary?: string
  loss_cause_tertiary?: string
  loss_cause_confidence?: number
  completeness_score?: number
  reasoning: string
  executive_summary?: string
  human_review_required: boolean
  agent_risk_levels?: Record<string, string>
}

interface AgentsPageProps {
  claimId: string | null
  isProcessing: boolean
  events: AgentEvent[]
  verdict: Verdict | null
  onNewClaim: () => void
  onOpenMonitoring?: () => void
  authToken?: string | null
}

/* ── Accent Color ── */
const ORANGE = '#fa4e0a'

/* ── SVG Icons ── */
const BrainSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
)
const GavelSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m14.5 12.5-5 5a2.12 2.12 0 1 0 3 3l5-5" /><path d="m16 16 6 6" /><path d="m8 8 2-2m8 8 2-2" /><path d="m9 7 8 8" /><path d="m21 11-8-8-2 2 8 8 2-2Z" /><path d="M3 21 7 17" />
  </svg>
)
const SparkSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
  </svg>
)
const SendSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
)
const CheckSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
  </svg>
)
const WarnSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4m0 4h.01" />
  </svg>
)
const DataSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
  </svg>
)
const DocSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8m8 4H8m2-8H8" />
  </svg>
)
const ImgSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
)

/* ── Shared card style ── */
const cardBase: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  overflow: 'hidden',
}

/* ── Inline Thinking Block (Copilot-style) ── */
const ThinkingBlock = ({ content, isExpanded, onToggle }: { content: string, isExpanded: boolean, onToggle: () => void }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const displayedContent = useTypewriter(content)

  // Auto-scroll as typewriter reveals text
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayedContent, isExpanded])

  // Custom renderer for basic markdown-like streaming content
  const MarkdownLite = ({ text }: { text: string }) => {
    const lines = text.split('\n')
    
    const highlightKeywords = (str: string) => {
      const parts = str.split(/(\b(?:Analysis|Review|Check|Conclusion|Step \d+|Primary|Secondary|Tertiary|Confidence|Note)\b|:\s)/g)
      return parts.map((part, j) => {
        if (/^(Analysis|Review|Check|Conclusion|Step \d+|Primary|Secondary|Tertiary|Confidence|Note)$/.test(part)) {
          return <span key={j} style={{ color: '#059669', fontWeight: 600 }}>{part}</span>
        }
        return part
      })
    }

    return (
      <div style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontSize: '12px', lineHeight: '1.7', color: '#4b5563' }}>
        {lines.map((line, i) => {
          // Check for bullet points
          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ')
          const cleanLine = isBullet ? line.trim().substring(2) : line

          // Basic formatting
          const formattedContent = cleanLine.split(/(\*\*.*?\*\*)/g).map((part, j) => 
            part.startsWith('**') && part.endsWith('**') 
              ? <strong key={j} style={{ color: '#111827', fontWeight: 600 }}>{part.slice(2, -2)}</strong> 
              : <span key={j}>{highlightKeywords(part)}</span>
          )

          return (
            <div key={i} style={{ 
              minHeight: '1em', 
              display: 'flex', 
              paddingLeft: isBullet ? '16px' : '0',
              position: 'relative',
              marginBottom: '3px'
            }}>
              {isBullet && (
                <span style={{ 
                  position: 'absolute', 
                  left: '4px', 
                  top: '9px',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block' 
                }} />
              )}
              <span>{formattedContent}</span>
            </div>
          )
        })}
        <div style={{ display: 'inline-block', width: '6px', height: '14px', background: '#10b981', animation: 'apBlink 1s step-end infinite', verticalAlign: 'middle', marginLeft: '4px', opacity: 0.7 }} />
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.03)', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'linear-gradient(to right, #fbfbfa, #ffffff)',
          borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
        onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(to right, #fbfbfa, #ffffff)'}
      >
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '16px', height: '16px', borderRadius: '4px', background: '#d1fae5', color: '#059669'
        }}>
          <BrainSvg /> 
          {/* Note: BrainSvg is 18x18, might need scaling or explicit width/height in SVG. Assuming it fits or scales. */}
        </div>
        
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Thinking Process</span>
        
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isExpanded ? 'Hide' : 'Show'} 
          <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </span>
      </button>
      
      {isExpanded && (
        <div ref={contentRef} style={{
          padding: '12px 14px',
          background: '#ffffff',
          maxHeight: '280px',
          overflowY: 'auto',
          scrollBehavior: 'smooth'
        }}>
          <MarkdownLite text={displayedContent} />
        </div>
      )}
    </div>
  )
}

/* ── Rich Summary Renderer for summary chat bubbles ── */
const SummaryRenderer = ({ content }: { content: string }) => {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    elements.push(
      <div key={`list-${elements.length}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
        {listItems.map((item, j) => {
          const numMatch = item.match(/^(\d+)\.\s*(.*)/)
          const bulletMatch = !numMatch && item.match(/^[-*]\s*(.*)/)
          const text = numMatch ? numMatch[2] : bulletMatch ? bulletMatch[1] : item
          return (
            <div key={j} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px', flexShrink: 0, marginTop: '1px', minWidth: '16px', textAlign: 'center' }}>
                {numMatch ? numMatch[1] : '•'}
              </span>
              <span style={{ fontSize: '11px', color: '#334155', lineHeight: 1.5, flex: 1 }}>
                {renderInline(text)}
              </span>
            </div>
          )
        })}
      </div>
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { flushList(); continue }

    // Headings: ## Heading or **Heading** on its own line
    const h2Match = trimmed.match(/^##\s+(.+)/)
    const boldLineMatch = !h2Match && trimmed.match(/^\*\*(.+?)\*\*$/)
    if (h2Match || boldLineMatch) {
      flushList()
      const heading = h2Match ? h2Match[1] : boldLineMatch![1]
      elements.push(
        <div key={`h-${i}`} style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', marginTop: elements.length > 0 ? '8px' : '0', marginBottom: '2px', paddingBottom: '3px', borderBottom: '1px solid #e2e8f0' }}>
          {heading}
        </div>
      )
      continue
    }

    // Verdict line
    if (trimmed.startsWith('Verdict:')) {
      flushList()
      const vText = trimmed.replace('Verdict:', '').trim()
      const isSIU = /SIU|REJECT/i.test(vText)
      const isManual = /MANUAL REVIEW|FLAG/i.test(vText)
      const badgeLabel = isSIU ? 'SIU' : isManual ? 'MANUAL REVIEW' : 'AUTO APPROVE'
      elements.push(
        <div key={`v-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, color: '#fff', padding: '3px 10px', borderRadius: '5px',
            background: isSIU ? '#dc2626' : isManual ? '#d97706' : '#16a34a',
          }}>{badgeLabel}</span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>{vText.replace(/^(SIU|MANUAL REVIEW|AUTO APPROVE|REJECT|FLAG|APPROVE)\s*[—–-]\s*/i, '')}</span>
        </div>
      )
      continue
    }

    // Reasoning: / Summary: labels
    if (trimmed.startsWith('Reasoning:') || trimmed.startsWith('Summary:')) {
      flushList()
      const colonIdx = trimmed.indexOf(':')
      const label = trimmed.slice(0, colonIdx)
      const text = trimmed.slice(colonIdx + 1).trim()
      elements.push(
        <div key={`lbl-${i}`} style={{ marginTop: elements.length > 0 ? '6px' : '0', marginBottom: '2px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', background: '#f0f9ff', padding: '1px 6px', borderRadius: '3px' }}>{label}</span>
          <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, marginTop: '3px' }}>{renderInline(text)}</div>
        </div>
      )
      continue
    }

    // Numbered or bullet lists
    if (/^\d+\.\s/.test(trimmed) || /^[-*]\s/.test(trimmed)) {
      listItems.push(trimmed)
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(
      <div key={`p-${i}`} style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, marginTop: '2px' }}>
        {renderInline(trimmed)}
      </div>
    )
  }
  flushList()

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>
}

/** Render inline bold markers */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 600, color: '#1e293b' }}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

/* ── Typewriter text wrapper for streaming bubbles ── */
const TypewriterSpan = ({ text }: { text: string }) => {
  const displayed = useTypewriter(text)
  return <>{displayed}</>
}

/* ── Unified Chat Stream (combines agent events + user chat) ── */
const UnifiedChatStream = ({
  events,
  chatMessages,
  placeholder,
  streamingContent,
  isStreaming,
  agentName = 'Loss Cause Agent'
}: {
  events: AgentEvent[]
  chatMessages: { role: string, content: string }[]
  placeholder: string
  streamingContent?: string
  isStreaming?: boolean
  agentName?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  // Track COLLAPSED thinking blocks instead of expanded ones, so default is Expanded
  const [collapsedThinking, setCollapsedThinking] = useState<Set<number>>(new Set())

  const toggleThinking = (index: number) => {
    setCollapsedThinking(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Group events with their preceding reasoning
  const groupedMessages = useMemo(() => {
    const result: Array<{
      role: 'agent' | 'user'
      content: string
      timestamp?: string
      type?: string
      thinking?: string
      isSummary?: boolean
    }> = []

    let currentThinking = ''

    for (const ev of events) {
      if (ev.type === 'reasoning') {
        currentThinking += ev.content + '\n'
      } else {
        result.push({
          role: 'agent',
          content: ev.content,
          timestamp: ev.timestamp,
          type: ev.type,
          thinking: currentThinking.trim() || undefined,
          isSummary: !!(ev.data as Record<string, unknown> | undefined)?._isSummary,
        })
        currentThinking = ''
      }
    }
    
    // Add any pending thinking content as a standalone message if it exists
    if (currentThinking.trim()) {
      result.push({
        role: 'agent',
        content: '', // Empty content, just thinking
        type: 'reasoning',
        thinking: currentThinking.trim()
      })
    }

    // Add chat messages
    for (const msg of chatMessages) {
      result.push({
        role: msg.role === 'user' ? 'user' : 'agent',
        content: msg.content,
        type: 'chat'
      })
    }

    return result
  }, [events, chatMessages])

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [events, chatMessages, streamingContent])

  return (
    <div ref={ref} style={{
      flex: 1,
      overflowY: 'auto',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minHeight: '120px'
    }}>
      {groupedMessages.length === 0 && !isStreaming ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '11px', fontStyle: 'italic' }}>
          {placeholder}
        </div>
      ) : (
        <>
          {groupedMessages.map((msg, i) => (
            <div key={i} style={{
              padding: msg.isSummary ? '10px 12px' : '8px 10px',
              borderRadius: '8px',
              background: msg.role === 'user' ? '#fff' : msg.isSummary ? '#f8fafc' : '#f0fdf4',
              border: `1px solid ${msg.role === 'user' ? '#e5e7eb' : msg.isSummary ? '#cbd5e1' : '#86efac'}`,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.isSummary ? '100%' : '90%',
              ...(msg.isSummary ? { borderLeft: '3px solid #3b82f6' } : {}),
            }}>
              <div style={{ fontSize: '9px', color: msg.role === 'user' ? '#9ca3af' : '#16a34a', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {msg.role === 'user' ? 'You' : agentName}
                {msg.isSummary && <span style={{ fontSize: '8px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>Summary</span>}
                {msg.timestamp && msg.type !== 'chat' && <span style={{ fontWeight: 400, color: '#9ca3af' }}>• {msg.timestamp}</span>}
              </div>
              {/* Inline Thinking Block */}
              {msg.thinking && (
                <ThinkingBlock
                  content={msg.thinking}
                  isExpanded={!collapsedThinking.has(i)}
                  onToggle={() => toggleThinking(i)}
                />
              )}
              {msg.isSummary ? (
                <SummaryRenderer content={msg.content} />
              ) : (
                <div style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.content
                    .replace(/##\s*/g, '') // Remove markdown headers
                    .replace(/\*\*/g, '')   // Remove bold markers
                    .replace(/\n{3,}/g, '\n\n') // Normalize excessive newlines
                  }
                </div>
              )}
            </div>
          ))}
          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              alignSelf: 'flex-start',
              maxWidth: '90%',
            }}>
              <div style={{ fontSize: '9px', color: '#16a34a', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase' }}>
                {agentName}
              </div>
              <div style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <TypewriterSpan text={streamingContent
                  .replace(/##\s*/g, '')
                  .replace(/\*\*/g, '')
                  .replace(/\n{3,}/g, '\n\n')
                } />
                <span style={{ animation: 'apBlink 1s infinite' }}>▋</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Stop/Cancel Icon ── */
const StopSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)

/* ── Chat input ── */
const ChatBox = ({ onSend, onCancel, isLoading, isDisabled, disabledReason }: { onSend: (m: string) => void; onCancel?: () => void; isLoading?: boolean; isDisabled?: boolean; disabledReason?: string }) => {
  const [val, setVal] = useState('')
  const send = () => { if (val.trim() && !isLoading && !isDisabled) { onSend(val); setVal('') } }
  const disabled = !isLoading && isDisabled

  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb' }}>
      {/* Loading indicator with moving dots */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '4px 0' }}>
          <span style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>Thinking</span>
          <span style={{ display: 'flex', gap: '2px' }}>
            <span style={{ width: '4px', height: '4px', background: '#9ca3af', borderRadius: '50%', animation: 'apBounce 0.6s infinite alternate' }} />
            <span style={{ width: '4px', height: '4px', background: '#9ca3af', borderRadius: '50%', animation: 'apBounce 0.6s infinite alternate 0.2s' }} />
            <span style={{ width: '4px', height: '4px', background: '#9ca3af', borderRadius: '50%', animation: 'apBounce 0.6s infinite alternate 0.4s' }} />
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={disabled ? (disabledReason || "Agent is thinking...") : "Ask agent..."}
          disabled={disabled || isLoading}
          style={{ flex: 1, padding: '6px 10px', fontSize: '11px', color: disabled || isLoading ? '#9ca3af' : '#1f2937', background: disabled || isLoading ? '#f3f4f6' : '#f9fafb', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
        />
        {isLoading ? (
          <button onClick={onCancel} style={{ padding: '6px 9px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Stop response">
            <StopSvg />
          </button>
        ) : (
          <button onClick={send} disabled={disabled} style={{ padding: '6px 9px', background: disabled ? '#d1d5db' : ORANGE, border: 'none', borderRadius: '6px', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
            <SendSvg />
          </button>
        )}
      </div>
    </div>
  )
}



/* ── Taxonomy SVG Icon ── */
const TaxSvg = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

/* ── Taxonomy Modal ── */
const TAX_COLOR = '#4f46e5'   // single indigo accent for all PLC/SLC/TLC nodes
const ChevMod = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

interface TaxonomyData { levels: number; taxonomy: Record<string, Record<string, string[]> | string[]>; lob_list?: string[]; taxonomy_by_lob?: Record<string, Record<string, Record<string, string[]> | string[]>> }

const TaxonomyModal = ({ onClose }: { onClose: () => void }) => {
  const [data, setData] = useState<TaxonomyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsedPLC, setCollapsedPLC] = useState<Set<string>>(new Set())
  const [collapsedSLC, setCollapsedSLC] = useState<Set<string>>(new Set())
  const [selectedLOB, setSelectedLOB] = useState<string>('Auto')

  const togglePLC = (plc: string) => setCollapsedPLC(p => { const n = new Set(p); n.has(plc) ? n.delete(plc) : n.add(plc); return n })
  const toggleSLC = (key: string) => setCollapsedSLC(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/taxonomy`)
      .then(r => r.json())
      .then((d: TaxonomyData) => {
        setData(d)
        setLoading(false)
        // start fully collapsed
        setCollapsedPLC(new Set(Object.keys(d.taxonomy)))
      })
      .catch(() => { setErr(true); setLoading(false) })
  }, [])

  const match = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase())

  // Get active taxonomy based on LOB selection
  const activeTaxonomy = data ? (selectedLOB === 'all' ? data.taxonomy : (data.taxonomy_by_lob?.[selectedLOB] || data.taxonomy)) : {}
  const lobList = data?.lob_list || []

  const totalCategories = Object.keys(activeTaxonomy).length
  const totalSLC = Object.values(activeTaxonomy).reduce((s, v) => s + (Array.isArray(v) ? v.length : Object.keys(v).length), 0)
  const totalTLC = Object.values(activeTaxonomy).reduce((s, v) => {
    if (Array.isArray(v)) return s
    return s + Object.values(v as Record<string, string[]>).reduce((ss, arr) => ss + (Array.isArray(arr) ? arr.length : 0), 0)
  }, 0)

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(3px)' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(820px, 92vw)', maxHeight: '85vh',
        background: '#fff', borderRadius: '16px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg,#111827 0%,#1f2937 100%)',
          display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0,
        }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TaxSvg />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Loss Cause Taxonomy</div>
            {data && (
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                {totalCategories} primary &nbsp;·&nbsp; {totalSLC} secondary {totalTLC > 0 ? `· ${totalTLC} tertiary` : ''} &nbsp;·&nbsp; {data.levels}-level hierarchy
              </div>
            )}
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#374151', border: '1px solid #4b5563', borderRadius: '8px', padding: '6px 10px', gap: '6px', width: '180px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: '#f9fafb', flex: 1, width: 0 }} />
            {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0, lineHeight: 1 }}>✕</button>}
          </div>

          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #4b5563', background: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18 M6 6l12 12"/></svg>
          </button>
        </div>

        {/* LOB tabs + Stats bar */}
        {data && (
          <div style={{ flexShrink: 0 }}>
            {lobList.length > 0 && (
              <div style={{ display: 'flex', gap: '0', padding: '0 20px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                {['all', ...lobList].map(lob => (
                  <button key={lob} onClick={() => { setSelectedLOB(lob); setCollapsedPLC(new Set(Object.keys(lob === 'all' ? data.taxonomy : (data.taxonomy_by_lob?.[lob] || {})))) }}
                    style={{
                      padding: '8px 16px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      background: selectedLOB === lob ? '#fff' : 'transparent',
                      color: selectedLOB === lob ? ORANGE : '#6b7280',
                      border: 'none', borderBottom: selectedLOB === lob ? `2px solid ${ORANGE}` : '2px solid transparent',
                      transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}
                    onMouseEnter={e => { if (selectedLOB !== lob) e.currentTarget.style.color = '#374151' }}
                    onMouseLeave={e => { if (selectedLOB !== lob) e.currentTarget.style.color = '#6b7280' }}
                  >{lob === 'all' ? 'All LOBs' : lob}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', padding: '10px 20px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              {[
                { label: 'Primary (PLC)', value: totalCategories, color: '#6366f1', bg: '#eef2ff' },
                { label: 'Secondary (SLC)', value: totalSLC, color: '#8b5cf6', bg: '#f5f3ff' },
                ...(totalTLC > 0 ? [{ label: 'Tertiary (TLC)', value: totalTLC, color: '#ec4899', bg: '#fdf2f8' }] : []),
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '8px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mind-map tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#f8fafc' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `3px solid #f3f4f6`, borderTopColor: ORANGE, animation: 'apSpin 1s linear infinite' }} />
            </div>
          )}
          {err && <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '13px' }}>Failed to load taxonomy</div>}
          {data && (() => {
            // ── Layout constants ─────────────────────────────────────
            const STRIDE = 26, PAD = 36
            const F = 'ui-sans-serif,system-ui,-apple-system,sans-serif'
            const COL = { root: 78, plc: 248, slc: 468, tlc: 672 }
            const NW  = { root: 114, plc: 168, slc: 160, tlc: 152 }
            const NH  = 24
            // chevron indicator size
            const CV = 7

            // ── Build layout (leaf-counting, respects collapsed state) ─
            let cur = 0
            const plcLayouts = Object.entries(activeTaxonomy)
              .filter(([plc]) => match(plc))
              .map(([plc, val]) => {
                const color = TAX_COLOR
                const isList = Array.isArray(val)
                const plcCollapsed = collapsedPLC.has(plc)
                const plcStart = cur

                let slcLayouts: { slc: string; tlcs: string[]; s0: number; lc: number; slcKey: string }[] = []

                if (!plcCollapsed) {
                  slcLayouts = isList
                    ? (val as string[]).map(slc => {
                        const s = cur++
                        return { slc, tlcs: [] as string[], s0: s, lc: 1, slcKey: `${plc}::${slc}` }
                      })
                    : Object.entries(val as Record<string, string[]>).map(([slc, tlcs]) => {
                        const arr = Array.isArray(tlcs) ? tlcs : []
                        const slcKey = `${plc}::${slc}`
                        const slcCollapsed = collapsedSLC.has(slcKey)
                        const lc = slcCollapsed ? 1 : Math.max(arr.length, 1)
                        const s = cur; cur += lc
                        return { slc, tlcs: arr, s0: s, lc, slcKey }
                      })
                }

                // collapsed PLC takes exactly 1 slot
                if (plcCollapsed) cur++

                const plcLc = cur - plcStart
                return { plc, color, slcLayouts, s0: plcStart, lc: plcLc, collapsed: plcCollapsed }
              })

            if (plcLayouts.length === 0) return (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '13px' }}>
                No results for "{search}"
              </div>
            )

            const total = cur
            const svgH = PAD * 2 + total * STRIDE
            const svgW = 870
            const rootY = svgH / 2

            // ── Helpers ──────────────────────────────────────────────
            const nY = (s0: number, lc: number) => PAD + (s0 + lc / 2) * STRIDE
            const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s
            const bez = (x1: number, y1: number, x2: number, y2: number) => {
              const m = (x1 + x2) / 2
              return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`
            }
            // small chevron path (right-pointing or down-pointing)
            const chevPath = (cx: number, cy: number, open: boolean) => open
              ? `M${cx - CV / 2},${cy - CV / 3} L${cx},${cy + CV / 3} L${cx + CV / 2},${cy - CV / 3}`
              : `M${cx - CV / 3},${cy - CV / 2} L${cx + CV / 3},${cy} L${cx - CV / 3},${cy + CV / 2}`

            return (
              <svg width={svgW} height={Math.max(svgH, 300)} style={{ display: 'block', minWidth: svgW }}>

                {/* subtle grid lines */}
                {Array.from({ length: Math.floor(svgH / 26) }).map((_, i) => (
                  <line key={i} x1={0} y1={PAD + i * STRIDE + STRIDE / 2} x2={svgW} y2={PAD + i * STRIDE + STRIDE / 2}
                    stroke="#e2e8f0" strokeWidth={0.4} />
                ))}

                {/* Root node */}
                <rect x={COL.root - NW.root / 2} y={rootY - NH / 2} width={NW.root} height={NH} rx={NH / 2}
                  fill="#1f2937" />
                <text x={COL.root} y={rootY + 4.5} textAnchor="middle" fontSize={11} fontWeight={700}
                  fill="#fff" fontFamily={F}>Loss Cause</text>

                {plcLayouts.map(({ plc, color, slcLayouts, s0, lc, collapsed }) => {
                  const plcY = nY(s0, lc)
                  const hasSLC = !collapsed && slcLayouts.length > 0
                  const hasChildren = Array.isArray(activeTaxonomy[plc])
                    ? (activeTaxonomy[plc] as string[]).length > 0
                    : Object.keys(activeTaxonomy[plc] as Record<string, string[]>).length > 0

                  return (
                    <g key={plc}>
                      {/* Root → PLC edge */}
                      <path d={bez(COL.root + NW.root / 2, rootY, COL.plc - NW.plc / 2, plcY)}
                        fill="none" stroke={color} strokeWidth={1.6} opacity={0.5} />

                      {/* PLC node — clickable */}
                      <g onClick={() => hasChildren && togglePLC(plc)} style={{ cursor: hasChildren ? 'pointer' : 'default' }}>
                        <rect x={COL.plc - NW.plc / 2} y={plcY - NH / 2} width={NW.plc} height={NH} rx={NH / 2}
                          fill={color} opacity={collapsed ? 0.75 : 1} />
                        {/* chevron indicator */}
                        {hasChildren && (
                          <path d={chevPath(COL.plc - NW.plc / 2 + 14, plcY, !collapsed)}
                            fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        <text x={COL.plc + (hasChildren ? 4 : 0)} y={plcY + 4.5} textAnchor="middle" fontSize={10.5} fontWeight={700}
                          fill="#fff" fontFamily={F}>{trunc(plc, 20)}</text>
                        {/* collapsed count badge */}
                        {collapsed && (
                          <text x={COL.plc + NW.plc / 2 - 18} y={plcY + 4.5} textAnchor="middle" fontSize={8.5} fontWeight={700}
                            fill="rgba(255,255,255,0.65)" fontFamily={F}>
                            {Array.isArray(activeTaxonomy[plc]) ? (activeTaxonomy[plc] as string[]).length : Object.keys(activeTaxonomy[plc] as Record<string,string[]>).length}
                          </text>
                        )}
                      </g>

                      {hasSLC && slcLayouts.map(({ slc, tlcs, s0: ss, lc: sl, slcKey }) => {
                        const slcY = nY(ss, sl)
                        const slcCollapsed = collapsedSLC.has(slcKey)
                        const hasTLC = tlcs.length > 0
                        const showTLCs = hasTLC && !slcCollapsed

                        return (
                          <g key={slc}>
                            {/* PLC → SLC edge */}
                            <path d={bez(COL.plc + NW.plc / 2, plcY, COL.slc - NW.slc / 2, slcY)}
                              fill="none" stroke={color} strokeWidth={1} opacity={0.4} />

                            {/* SLC node — clickable if has TLC */}
                            <g onClick={() => hasTLC && toggleSLC(slcKey)} style={{ cursor: hasTLC ? 'pointer' : 'default' }}>
                              <rect x={COL.slc - NW.slc / 2} y={slcY - (NH - 2) / 2} width={NW.slc} height={NH - 2} rx={(NH - 2) / 2}
                                fill="#fff" stroke={color} strokeWidth={1.2} opacity={slcCollapsed ? 0.7 : 1} />
                              {/* chevron indicator for SLC */}
                              {hasTLC && (
                                <path d={chevPath(COL.slc - NW.slc / 2 + 12, slcY, !slcCollapsed)}
                                  fill="none" stroke={color} strokeWidth={1.4} opacity={0.7} strokeLinecap="round" strokeLinejoin="round" />
                              )}
                              <text x={COL.slc + (hasTLC ? 4 : 0)} y={slcY + 4} textAnchor="middle" fontSize={9.5} fontWeight={600}
                                fill={color} fontFamily={F}>{trunc(slc, 19)}</text>
                              {/* collapsed TLC count */}
                              {slcCollapsed && hasTLC && (
                                <text x={COL.slc + NW.slc / 2 - 14} y={slcY + 4} textAnchor="middle" fontSize={8} fontWeight={700}
                                  fill={color} opacity={0.6} fontFamily={F}>{tlcs.length}</text>
                              )}
                            </g>

                            {/* TLC children */}
                            {showTLCs && tlcs.map((tlc, ti) => {
                              const tlcY = PAD + (ss + ti + 0.5) * STRIDE
                              return (
                                <g key={tlc}>
                                  <path d={bez(COL.slc + NW.slc / 2, slcY, COL.tlc - NW.tlc / 2, tlcY)}
                                    fill="none" stroke={color} strokeWidth={0.8} opacity={0.3} />
                                  <rect x={COL.tlc - NW.tlc / 2} y={tlcY - (NH - 5) / 2} width={NW.tlc} height={NH - 5} rx={(NH - 5) / 2}
                                    fill={color + '12'} stroke={color + '55'} strokeWidth={0.8} />
                                  <text x={COL.tlc} y={tlcY + 3.5} textAnchor="middle" fontSize={9} fontWeight={400}
                                    fill="#6b7280" fontFamily={F}>{trunc(tlc, 21)}</text>
                                </g>
                              )
                            })}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
            )
          })()}
        </div>
      </div>
    </>
  )
}

/* ── Section header ── */
const Header = ({ icon, title, sub, active, actions }: { icon: React.ReactNode; title: string; sub: string; active: boolean; actions?: React.ReactNode }) => (
  <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px', background: '#fafafa' }}>
    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {active && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ORANGE, display: 'inline-block', animation: 'apPulse 1.5s infinite' }} />}
        {sub}
      </div>
    </div>
    {actions}
  </div>
)

/* ══════════════ SUB-AGENT MINI CARD ══════════════ */
/* ── Inline SVG status icons for event lines ── */
const SpinnerSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: 'apSpin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const TickSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
    <path d="M8 12l3 3 5-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const FailSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" fill="#fef2f2" stroke="#ef4444" strokeWidth="2" />
    <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const SearchSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: 'apPulse 1.5s infinite' }}>
    <circle cx="11" cy="11" r="7" stroke="#3b82f6" strokeWidth="2" />
    <path d="m16 16 4 4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const AnalyzeSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, animation: 'apPulse 1.5s infinite' }}>
    <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" fill="#f59e0b" opacity="0.7" />
  </svg>
)
const InfoSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
    <path d="M12 16v-4m0-4h.01" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/** Determine which icon to show for a PAST event line (not the active one).
 *  Animated icons are only used for the in-progress event via `isInProgress`. */
const eventIcon = (content: string, type: string) => {
  if (type === 'result') return <TickSvg />
  if (type === 'error') return <FailSvg />
  const c = content.toLowerCase()
  if (c.startsWith('✓') || c.startsWith('✔')) return <TickSvg />
  if (c.startsWith('✗') || c.startsWith('✘') || c.includes('failed')) return <FailSvg />
  if (c.includes('complete') || c.includes('done') || c.includes('finished') || c.includes('fetched')) return <TickSvg />
  // Past processing/searching/checking events already finished → show tick
  if (c.includes('searching') || c.includes('running') || c.includes('processing') || c.includes('checking')) return <TickSvg />
  if (c.includes('generat') || c.includes('analys') || c.includes('synthesiz')) return <InfoSvg />
  return <InfoSvg />
}

/** Strip leading emoji check/cross marks for cleaner display */
const cleanContent = (content: string) => content.replace(/^[✓✔✗✘]\s*/, '')

const SubAgentCard = ({ name, icon, events, done, active, orchestratorRisk }: {
  name: string; icon: React.ReactNode; events: AgentEvent[]; done: boolean; active: boolean; orchestratorRisk?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }) }, [events])

  // Detect risk level from the final result event: HIGH / MODERATE / LOW
  // Uses BOTH structured data fields (reliable) AND regex on text (fallback)
  const resultEv = done ? events.find(e => e.type === 'result') : null
  const resultText = resultEv?.content || ''
  const rd = (resultEv?.data || {}) as Record<string, unknown>

  // ── Structured data detection (reliable — uses agent findings object) ──
  const aiCls = String(rd.ai_classification || '')
  const aiProb = Number(rd.ai_probability || 0)
  const foundOnline = rd.available_on_internet === true
  const riskScore = Number(rd.risk_score || 0) / 100          // document agent: 0-100 → 0-1
  const webRisk = Number(rd.web_risk_signal || 0)
  const ringRisk = Number(rd.fraud_ring_risk_score || 0)
  const mlProb = Number(rd.ml_fraud_probability || 0)

  // ── Regex fallback on display text ──
  const pctRisk = parseInt(resultText.match(/risk signal:\s*(\d+)%/)?.[1] || '0')
  const pctScore = parseInt(resultText.match(/Score:\s*(\d+)%/)?.[1] || '0')

  const isHigh = done && (
    aiCls === 'AI Generated' ||
    riskScore >= 0.66 || webRisk >= 0.66 || ringRisk >= 0.66 || mlProb >= 0.66 ||
    /HIGH|CRITICAL/i.test(resultText) ||
    pctRisk >= 66 || pctScore >= 66
  )
  const isModerate = !isHigh && done && (
    aiCls === 'AI Edited' || aiCls === 'Digitally Edited' ||
    foundOnline ||
    (aiProb >= 0.33 && aiCls !== 'Real') ||
    riskScore >= 0.33 || webRisk >= 0.33 || ringRisk >= 0.33 || mlProb >= 0.33 ||
    /MODERATE|WARNING/i.test(resultText) ||
    /AI Edited/i.test(resultText) || /Digitally Edited/i.test(resultText) ||
    (/Found(?:\s+online|\s*\()/i.test(resultText) && !/NOT found/i.test(resultText)) ||
    pctRisk >= 33 || pctScore >= 33
  )
  // Prefer orchestrator's authoritative risk level when available (it factors in date comparison etc.)
  const derivedTier: 'high' | 'moderate' | 'low' = isHigh ? 'high' : isModerate ? 'moderate' : 'low'
  const orchTier: 'high' | 'moderate' | 'low' | null = orchestratorRisk === 'HIGH' ? 'high' : orchestratorRisk === 'MODERATE' ? 'moderate' : orchestratorRisk === 'LOW' ? 'low' : null
  const riskTier: 'high' | 'moderate' | 'low' = orchTier ?? derivedTier

  const tierStyles = {
    high:     { border: '#fca5a5', bg: '#fef2f2', icon: '#dc2626', text: '#991b1b' },
    moderate: { border: '#fcd34d', bg: '#fffbeb', icon: '#d97706', text: '#78350f' },
    low:      { border: '#86efac', bg: '#fafafa', icon: '#16a34a', text: '#374151' },
  }
  const ts = done ? tierStyles[riskTier] : { border: active ? `${ORANGE}60` : '#e5e7eb', bg: '#fafafa', icon: '#6b7280', text: '#374151' }

  return (
    <div style={{
      ...cardBase,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${ts.border}`,
      transition: 'border-color 0.3s',
    }}>
      {/* Mini header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', background: done ? ts.bg : '#fafafa' }}>
        <span style={{ color: ts.icon, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: ts.text }}>{name}</span>
        <div style={{ marginLeft: 'auto' }}>
          {done ? (
            riskTier === 'low'
              ? <span style={{ color: '#16a34a', display: 'flex' }}><CheckSvg /></span>
              : <span style={{ color: riskTier === 'high' ? '#dc2626' : '#d97706', display: 'flex' }}><WarnSvg /></span>
          ) : active ? (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ORANGE, display: 'inline-block', animation: 'apPulse 1.5s infinite' }} />
          ) : (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} />
          )}
        </div>
      </div>
      {/* Events */}
      <div ref={ref} style={{ overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: 0 }}>
        {events.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>Waiting...</div>
        ) : events.map((ev, i) => {
          const isLast = i === events.length - 1
          const isInProgress = isLast && !done && active && ev.type !== 'result'

          // Parse severity prefix from document agent events: [HIGH], [MEDIUM], [LOW]
          const sevMatch = ev.content.match(/^\[(HIGH|MEDIUM|LOW)\]\s*(.*)/)
          const severity = sevMatch ? sevMatch[1] : null
          const sevContent = sevMatch ? sevMatch[2] : null
          const sevStyles: Record<string, { bg: string; border: string; badge: string; badgeBg: string; text: string }> = {
            HIGH:   { bg: '#fef2f2', border: '#dc2626', badge: '#dc2626', badgeBg: '#fee2e2', text: '#7f1d1d' },
            MEDIUM: { bg: '#fffbeb', border: '#d97706', badge: '#d97706', badgeBg: '#fef3c7', text: '#78350f' },
            LOW:    { bg: '#eff6ff', border: '#3b82f6', badge: '#3b82f6', badgeBg: '#dbeafe', text: '#1e3a5f' },
          }
          const sev = severity ? sevStyles[severity] : null

          // No image thumbnails in the card — view in details modal instead
          const imageUrls: string[] | undefined = undefined

          if (sev && sevContent) {
            return (
              <div key={i} style={{
                padding: '5px 8px', borderRadius: '4px', fontSize: '10px', lineHeight: 1.4,
                background: sev.bg, borderLeft: `3px solid ${sev.border}`,
                display: 'flex', alignItems: 'flex-start', gap: '6px',
              }}>
                <span style={{ fontSize: '8px', fontWeight: 700, color: sev.badge, background: sev.badgeBg, padding: '1px 4px', borderRadius: '3px', flexShrink: 0, marginTop: '1px' }}>{severity}</span>
                <span style={{ flex: 1, color: sev.text }}>{sevContent}</span>
              </div>
            )
          }

          // Detect 3-tier risk for event highlighting (uses same structured data + regex)
          const evData = (ev.data || {}) as Record<string, unknown>
          const evAiCls = String(evData.ai_classification || '')
          const evRiskPct = parseInt(ev.content.match(/risk signal:\s*(\d+)%/)?.[1] || '0')
          const evScorePct = parseInt(ev.content.match(/Score:\s*(\d+)%/)?.[1] || '0')
          const isHighResult = ev.type === 'result' && (
            evAiCls === 'AI Generated' ||
            /HIGH|CRITICAL/i.test(ev.content) ||
            (/AI Generated/i.test(ev.content) && !/Worst:\s*Real/i.test(ev.content)) ||
            evRiskPct >= 66 || evScorePct >= 66
          )
          const isModerateResult = !isHighResult && ev.type === 'result' && (
            evAiCls === 'AI Edited' || evAiCls === 'Digitally Edited' ||
            evData.available_on_internet === true ||
            /MODERATE|WARNING/i.test(ev.content) ||
            /AI Edited/i.test(ev.content) || /Digitally Edited/i.test(ev.content) ||
            (/Found(?:\s+online|\s*\()/i.test(ev.content) && !/NOT found/i.test(ev.content)) ||
            evRiskPct >= 33 || evScorePct >= 33
          )
          const localEvTier = isHighResult ? 'high' : isModerateResult ? 'moderate' : 'low'
          // For result events, use the card's authoritative riskTier (includes orchestrator override)
          const evTier = ev.type === 'result' ? riskTier : localEvTier
          const resultBg = ev.type === 'result'
            ? (evTier === 'high' ? '#fef2f2' : evTier === 'moderate' ? '#fffbeb' : '#f0fdf4')
            : ev.type === 'error' ? '#fef2f2' : isInProgress ? '#fefce8' : '#f9fafb'
          const resultBorder = ev.type === 'result'
            ? (evTier === 'high' ? '#dc2626' : evTier === 'moderate' ? '#d97706' : '#16a34a')
            : ev.type === 'error' ? '#ef4444' : isInProgress ? ORANGE : '#d1d5db'

          return (
            <div key={i}>
              <div style={{
                padding: '5px 8px', borderRadius: '4px', fontSize: '10px',
                color: evTier === 'high' ? '#7f1d1d' : evTier === 'moderate' ? '#78350f' : '#374141',
                lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '6px',
                fontWeight: evTier !== 'low' ? 600 : 400,
                background: resultBg,
                borderLeft: `2px solid ${resultBorder}`,
              }}>
                <span style={{ display: 'flex', marginTop: '1px' }}>
                  {isInProgress ? <SpinnerSvg /> : eventIcon(ev.content, ev.type)}
                </span>
                <span style={{ flex: 1 }}>{cleanContent(ev.content)}</span>
              </div>
              {imageUrls && imageUrls.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '6px 8px 2px' }}>
                  {imageUrls.map((url, j) => (
                    <img key={j} src={url} alt={`Evidence ${j + 1}`} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════ FLOW CONNECTOR SVG ══════════════ */
const FlowConnector = ({ active, done }: { active: boolean; done: boolean }) => {
  const lineColor  = done ? '#16a34a' : active ? ORANGE : '#d1d5db'
  const glowColor  = done ? '#22c55e' : ORANGE
  const particle   = done ? '#22c55e' : ORANGE

  // Smooth bezier curves converging to center-bottom
  const LP = 'M100,0 C100,26 300,14 300,38'   // left branch
  const CP = 'M300,0 L300,38'                  // center branch
  const RP = 'M500,0 C500,26 300,14 300,38'    // right branch

  return (
    <div style={{ padding: '0', position: 'relative' }}>
      <svg width="100%" height="42" viewBox="0 0 600 42" preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {/* Path glow */}
          <filter id="fcPathGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Node glow */}
          <filter id="fcNodeGlow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Gradient: faint at top → bright at merge */}
          <linearGradient id="lgL" x1="100" y1="0" x2="300" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="lgC" x1="300" y1="0" x2="300" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.9"/>
          </linearGradient>
          <linearGradient id="lgR" x1="500" y1="0" x2="300" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.9"/>
          </linearGradient>
        </defs>

        {/* ── Glow halos behind paths (active / done only) ── */}
        {(active || done) && <>
          <path d={LP} fill="none" stroke={glowColor} strokeWidth="6"  opacity="0.15" filter="url(#fcPathGlow)"/>
          <path d={CP} fill="none" stroke={glowColor} strokeWidth="6"  opacity="0.15" filter="url(#fcPathGlow)"/>
          <path d={RP} fill="none" stroke={glowColor} strokeWidth="6"  opacity="0.15" filter="url(#fcPathGlow)"/>
        </>}

        {/* ── Main paths with gradient stroke ── */}
        <path d={LP} fill="none" stroke="url(#lgL)" strokeWidth="1.8"
          strokeDasharray={done ? 'none' : '7 5'}>
          {active && !done && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.9s" repeatCount="indefinite"/>}
        </path>
        <path d={CP} fill="none" stroke="url(#lgC)" strokeWidth="1.8"
          strokeDasharray={done ? 'none' : '7 5'}>
          {active && !done && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.9s" repeatCount="indefinite"/>}
        </path>
        <path d={RP} fill="none" stroke="url(#lgR)" strokeWidth="1.8"
          strokeDasharray={done ? 'none' : '7 5'}>
          {active && !done && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.9s" repeatCount="indefinite"/>}
        </path>

        {/* ── Hidden ref paths for animateMotion ── */}
        <path id="fcLP" d={LP} fill="none" stroke="none"/>
        <path id="fcCP" d={CP} fill="none" stroke="none"/>
        <path id="fcRP" d={RP} fill="none" stroke="none"/>

        {/* ── Particles: 3 per branch, staggered ── */}
        {active && !done && ([0, 0.45, 0.9] as number[]).map((delay, i) => (
          <g key={i}>
            {/* Left */}
            <circle r="2.5" fill={particle} opacity="0.95" filter="url(#fcPathGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${delay}s`}><mpath href="#fcLP"/></animateMotion>
            </circle>
            {/* Left trail */}
            <circle r="1.5" fill={particle} opacity="0.4" filter="url(#fcPathGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${delay + 0.07}s`}><mpath href="#fcLP"/></animateMotion>
            </circle>
            {/* Center */}
            <circle r="2.5" fill={particle} opacity="0.95" filter="url(#fcPathGlow)">
              <animateMotion dur="1.1s" repeatCount="indefinite" begin={`${delay + 0.2}s`}><mpath href="#fcCP"/></animateMotion>
            </circle>
            <circle r="1.5" fill={particle} opacity="0.4" filter="url(#fcPathGlow)">
              <animateMotion dur="1.1s" repeatCount="indefinite" begin={`${delay + 0.27}s`}><mpath href="#fcCP"/></animateMotion>
            </circle>
            {/* Right */}
            <circle r="2.5" fill={particle} opacity="0.95" filter="url(#fcPathGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${delay + 0.1}s`}><mpath href="#fcRP"/></animateMotion>
            </circle>
            <circle r="1.5" fill={particle} opacity="0.4" filter="url(#fcPathGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${delay + 0.17}s`}><mpath href="#fcRP"/></animateMotion>
            </circle>
          </g>
        ))}

        {/* ── Merge node: expanding rings + solid core ── */}
        {active && !done && <>
          <circle cx="300" cy="38" r="5" fill="none" stroke={particle} strokeWidth="1.2" opacity="0">
            <animate attributeName="r"       values="5;16;16"    dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.7;0;0"    dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="300" cy="38" r="5" fill="none" stroke={particle} strokeWidth="1.2" opacity="0">
            <animate attributeName="r"       values="5;11;11"    dur="1.8s" repeatCount="indefinite" begin="0.5s"/>
            <animate attributeName="opacity" values="0.6;0;0"    dur="1.8s" repeatCount="indefinite" begin="0.5s"/>
          </circle>
        </>}
        {done && <>
          <circle cx="300" cy="38" r="9" fill="none" stroke={lineColor} strokeWidth="1" opacity="0.3"/>
          <circle cx="300" cy="38" r="6" fill="none" stroke={lineColor} strokeWidth="1" opacity="0.5"/>
        </>}
        <circle cx="300" cy="38" r="4" fill={lineColor}
          filter={active || done ? 'url(#fcNodeGlow)' : 'none'}>
          {done && <animate attributeName="r" values="4;5.5;4" dur="2s" repeatCount="indefinite"/>}
        </circle>
      </svg>
    </div>
  )
}

/* ══════════════ DECISION NODE ══════════════ */
const DecisionNode = ({ events, done, active }: { events: AgentEvent[]; done: boolean; active: boolean }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }) }, [events])

  return (
    <div style={{
      ...cardBase,
      border: done ? '1px solid #86efac' : active ? `1px solid ${ORANGE}60` : '1px solid #e5e7eb',
    }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', background: done ? '#f0fdf4' : '#fafafa' }}>
        <span style={{ color: done ? '#16a34a' : ORANGE, display: 'flex' }}><GavelSvg /></span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Final Decision</span>
        <div style={{ marginLeft: 'auto' }}>
          {done ? <span style={{ color: '#16a34a', display: 'flex' }}><CheckSvg /></span>
            : active ? <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ORANGE, display: 'inline-block', animation: 'apPulse 1.5s infinite' }} />
              : null}
        </div>
      </div>
      <div ref={ref} style={{ overflowY: 'auto', padding: '6px 8px', maxHeight: '80px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {events.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Awaiting agent results...</div>
        ) : events.map((ev, i) => (
          <div key={i} style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '10px', color: '#374151', lineHeight: 1.4, background: ev.type === 'result' ? '#f0fdf4' : '#f9fafb', borderLeft: `2px solid ${ev.type === 'result' ? '#16a34a' : '#d1d5db'}` }}>
            {ev.content}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ WEB SEARCH RESULTS MODAL ══════════════ */
interface WsHit { title: string; url: string; content?: string; snippet?: string; score?: number }
interface WsResultRow { query: string; hits: WsHit[] }

const WebSearchResultsModal = ({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) => {
  const results   = (data.results   as WsResultRow[] | undefined) || []
  const contras   = (data.contradictions  as string[] | undefined) || []
  const corrobos  = (data.corroborations  as string[] | undefined) || []
  const summary   = (data.summary   as string | undefined) || ''
  const weatherSkipped = data.weather_skipped as boolean | undefined
  const weatherSkipReason = (data.weather_skip_reason as string | undefined) || ''
  const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set([0]))
  const signal    = (data.web_risk_signal as number | undefined) ?? 0
  const signalPct = Math.round(signal * 100)
  const signalBg  = signalPct >= 66 ? '#dc2626' : signalPct >= 33 ? '#d97706' : '#16a34a'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(780px, 92vw)', maxHeight: '82vh',
        background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#0c4a6e 0%,#0369a1 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Web Search Results</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>{results.length} queries · {results.reduce((s, r) => s + r.hits.length, 0)} hits</div>
          </div>
          {signalPct < 33 ? (
            <span title="Low risk signal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#16a34a', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              Low Risk
            </span>
          ) : signalPct < 66 ? (
            <span title="Moderate risk signal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#d97706', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2L2 22h20L12 2z"/></svg>
              Moderate
            </span>
          ) : (
            <span title="High risk signal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>
              High Risk
            </span>
          )}
          <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Summary */}
          {summary && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Summary</div>
              <div style={{ fontSize: '12px', color: '#0c4a6e', lineHeight: 1.5 }}>{summary}</div>
            </div>
          )}

          {/* Weather Skipped Notice */}
          {weatherSkipped && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z"/>
              </svg>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Weather Verification Skipped</div>
                <div style={{ fontSize: '11px', color: '#78350f', lineHeight: 1.4 }}>{weatherSkipReason}</div>
              </div>
            </div>
          )}

          {/* Contradictions / Corroborations */}
          {(contras.length > 0 || corrobos.length > 0) && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {contras.length > 0 && (
                <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>⚠ Contradictions</div>
                  {contras.map((c, i) => <div key={i} style={{ fontSize: '11px', color: '#7f1d1d', marginBottom: '4px', lineHeight: 1.4 }}>• {c}</div>)}
                </div>
              )}
              {corrobos.length > 0 && (
                <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>✓ Corroborations</div>
                  {corrobos.map((c, i) => <div key={i} style={{ fontSize: '11px', color: '#14532d', marginBottom: '4px', lineHeight: 1.4 }}>• {c}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Per-query results (accordion) */}
          {results.map((row, qi) => {
            const isOpen = expandedQ.has(qi)
            return (
              <div key={qi} style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                {/* Query header — clickable */}
                <div
                  onClick={() => setExpandedQ(prev => { const s = new Set(prev); s.has(qi) ? s.delete(qi) : s.add(qi); return s })}
                  style={{ padding: '8px 12px', background: isOpen ? '#f0f9ff' : '#f8fafc', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: isOpen ? '8px 8px 0 0' : '8px', transition: 'background 0.15s' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>Q{qi + 1}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', flex: 1 }}>{row.query}</span>
                  <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>{row.hits.length} result{row.hits.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Hits — shown when expanded */}
                {isOpen && (
                  row.hits.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No results found</div>
                  ) : (
                    <div>
                      {row.hits.map((hit, hi) => (
                        <div key={hi} style={{ padding: '10px 14px', borderBottom: hi < row.hits.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
                            <a href={hit.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 600, color: '#1d4ed8', textDecoration: 'none', lineHeight: 1.3, flex: 1 }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                              {hit.title || 'Untitled'}
                            </a>
                            {hit.score != null && (
                              <span
                                title="Search relevance score"
                                style={{ fontSize: '9px', fontWeight: 600, color: hit.score >= 0.7 ? '#16a34a' : hit.score >= 0.4 ? '#d97706' : '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', flexShrink: 0, cursor: 'help' }}>
                                {hit.score >= 0.7 ? 'High' : hit.score >= 0.4 ? 'Medium' : 'Low'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px', wordBreak: 'break-all' }}>{hit.url}</div>
                          {(hit.content || hit.snippet) && (
                            <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.55, background: '#f9fafb', borderRadius: '6px', padding: '6px 10px', marginTop: '4px' }}>
                              {(() => { const t = (hit.content || hit.snippet) as string; return t.length > 350 ? t.slice(0, 350) + '...' : t })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}

          {results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '13px' }}>No search results available</div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════ FRAUD NETWORK GRAPH MODAL ══════════════ */
interface GraphNode { id: string; type: 'claim' | 'garage' | 'broker' | 'customer' | 'zip'; label: string; is_current?: boolean; fraud_flag?: number; fraud_rate?: number; total_claims?: number; past_claims?: number; prior_fraud?: number; amount?: number; broker?: string; garage?: string }
interface GraphEdge { source: string; target: string; type: string }
interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  claim:    { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '#3b82f6' },
  garage:   { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
  broker:   { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3', icon: '#6366f1' },
  customer: { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: '#10b981' },
  zip:      { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', icon: '#a855f7' },
}

const FraudNetworkModal = ({ data, riskScore, findings, summary, onClose }: {
  data: GraphData; riskScore: number; findings: string[]; summary: string; onClose: () => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const positionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map())
  const animFrameRef = useRef<number>(0)
  const iterRef = useRef(0)

  const riskPct = Math.round(riskScore * 100)
  const riskBg = riskPct >= 66 ? '#dc2626' : riskPct >= 33 ? '#d97706' : '#16a34a'

  const fraudClaims = data.nodes.filter(n => n.type === 'claim' && (n.fraud_flag || 0) >= 1 && !n.is_current).length
  const totalClaims = data.nodes.filter(n => n.type === 'claim' && !n.is_current).length

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.nodes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width = canvas.offsetWidth * 2
    const H = canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const cw = W / 2, ch = H / 2

    // Initialise positions with force layout starting positions
    const positions = positionsRef.current
    if (positions.size === 0) {
      const center = data.nodes.find(n => n.is_current)
      data.nodes.forEach((n, i) => {
        if (n.is_current) {
          positions.set(n.id, { x: cw / 2, y: ch / 2, vx: 0, vy: 0 })
        } else if (n.type !== 'claim') {
          // Entity nodes in a ring around centre
          const entityNodes = data.nodes.filter(nd => nd.type !== 'claim' && !nd.is_current)
          const idx = entityNodes.indexOf(n)
          const angle = (idx / entityNodes.length) * Math.PI * 2 - Math.PI / 2
          const radius = Math.min(cw, ch) * 0.28
          positions.set(n.id, { x: cw / 2 + Math.cos(angle) * radius, y: ch / 2 + Math.sin(angle) * radius, vx: 0, vy: 0 })
        } else {
          // Claim nodes: scatter around their connected entity
          const connEdge = data.edges.find(e => e.source === n.id || e.target === n.id)
          const parentId = connEdge ? (connEdge.source === n.id ? connEdge.target : connEdge.source) : null
          const parent = parentId ? positions.get(parentId) : null
          const angle = Math.random() * Math.PI * 2
          const radius = Math.min(cw, ch) * (0.35 + Math.random() * 0.22)
          const bx = parent ? parent.x : cw / 2
          const by = parent ? parent.y : ch / 2
          positions.set(n.id, {
            x: bx + Math.cos(angle) * radius * 0.5 + (Math.random() - 0.5) * 40,
            y: by + Math.sin(angle) * radius * 0.5 + (Math.random() - 0.5) * 40,
            vx: 0, vy: 0
          })
        }
      })
    }

    const nodeById = new Map(data.nodes.map(n => [n.id, n]))
    iterRef.current = 0

    const getRadius = (n: GraphNode) => {
      if (n.is_current) return 22
      if (n.type !== 'claim') return 18
      return 10
    }

    function simulate() {
      iterRef.current++
      const damping = Math.max(0.02, 0.92 - iterRef.current * 0.003)
      const alpha = Math.max(0.001, 1 - iterRef.current * 0.008)

      // Repulsion between all nodes
      for (const [idA, pA] of positions) {
        for (const [idB, pB] of positions) {
          if (idA >= idB) continue
          const dx = pB.x - pA.x, dy = pB.y - pA.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (800 * alpha) / (dist * dist)
          const fx = (dx / dist) * force, fy = (dy / dist) * force
          pA.vx -= fx; pA.vy -= fy
          pB.vx += fx; pB.vy += fy
        }
      }

      // Attraction along edges
      for (const e of data.edges) {
        const pA = positions.get(e.source), pB = positions.get(e.target)
        if (!pA || !pB) continue
        const dx = pB.x - pA.x, dy = pB.y - pA.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealLen = 90
        const force = (dist - idealLen) * 0.03 * alpha
        const fx = (dx / dist) * force, fy = (dy / dist) * force
        pA.vx += fx; pA.vy += fy
        pB.vx -= fx; pB.vy -= fy
      }

      // Centre gravity
      for (const [id, p] of positions) {
        const n = nodeById.get(id)
        if (n?.is_current) {
          // Strong pull to centre for current claim
          p.vx += (cw / 2 - p.x) * 0.05
          p.vy += (ch / 2 - p.y) * 0.05
        } else {
          p.vx += (cw / 2 - p.x) * 0.008 * alpha
          p.vy += (ch / 2 - p.y) * 0.008 * alpha
        }
      }

      // Apply velocity
      for (const [, p] of positions) {
        p.vx *= damping; p.vy *= damping
        p.x += p.vx; p.y += p.vy
        // Keep in bounds
        p.x = Math.max(30, Math.min(cw - 30, p.x))
        p.y = Math.max(30, Math.min(ch - 30, p.y))
      }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, cw, ch)

      // Draw edges
      for (const e of data.edges) {
        const pA = positions.get(e.source), pB = positions.get(e.target)
        if (!pA || !pB) continue
        const srcNode = nodeById.get(e.source)
        const tgtNode = nodeById.get(e.target)
        const isFraud = (srcNode?.fraud_flag || 0) >= 1 || (tgtNode?.fraud_flag || 0) >= 1
        const isCurrentEdge = srcNode?.is_current || tgtNode?.is_current

        ctx.beginPath()
        ctx.moveTo(pA.x, pA.y)
        ctx.lineTo(pB.x, pB.y)
        ctx.strokeStyle = isCurrentEdge ? (isFraud ? '#f87171' : '#60a5fa') : isFraud ? '#fca5a5' : '#d1d5db'
        ctx.lineWidth = isCurrentEdge ? 2 : 1
        if (!isCurrentEdge) ctx.setLineDash([4, 3])
        else ctx.setLineDash([])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw nodes
      for (const n of data.nodes) {
        const p = positions.get(n.id)
        if (!p) continue
        const r = getRadius(n)
        const colors = NODE_COLORS[n.type] || NODE_COLORS.claim
        const isFraud = n.type === 'claim' && (n.fraud_flag || 0) >= 1

        // Glow for current claim
        if (n.is_current) {
          ctx.beginPath()
          const grd = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 14)
          grd.addColorStop(0, 'rgba(59,130,246,0.25)')
          grd.addColorStop(1, 'rgba(59,130,246,0)')
          ctx.fillStyle = grd
          ctx.arc(p.x, p.y, r + 14, 0, Math.PI * 2)
          ctx.fill()
        }

        // Fraud glow
        if (isFraud && !n.is_current) {
          ctx.beginPath()
          const grd = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 10)
          grd.addColorStop(0, 'rgba(239,68,68,0.3)')
          grd.addColorStop(1, 'rgba(239,68,68,0)')
          ctx.fillStyle = grd
          ctx.arc(p.x, p.y, r + 10, 0, Math.PI * 2)
          ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isFraud ? '#fef2f2' : n.is_current ? '#eff6ff' : colors.bg
        ctx.fill()
        ctx.strokeStyle = isFraud ? '#ef4444' : n.is_current ? '#2563eb' : colors.border
        ctx.lineWidth = n.is_current ? 3 : isFraud ? 2.5 : 1.5
        ctx.stroke()

        // Icon inside node
        ctx.font = `${n.is_current ? 'bold ' : ''}${r * 0.7}px ui-sans-serif,system-ui,sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const icon = n.type === 'garage' ? 'G' : n.type === 'broker' ? 'B' : n.type === 'customer' ? 'C' : n.type === 'zip' ? 'Z' : ''
        if (n.type !== 'claim') {
          ctx.fillStyle = isFraud ? '#ef4444' : colors.icon
          ctx.fillText(icon, p.x, p.y)
        } else if (n.is_current) {
          ctx.fillStyle = '#2563eb'
          ctx.fillText('★', p.x, p.y + 1)
        } else if (isFraud) {
          ctx.fillStyle = '#ef4444'
          ctx.font = `${r * 0.8}px ui-sans-serif`
          ctx.fillText('!', p.x, p.y)
        }

        // Label below node
        ctx.font = `${n.is_current ? '600 ' : ''}${n.is_current ? 10 : 8}px ui-sans-serif,system-ui,sans-serif`
        ctx.fillStyle = isFraud ? '#dc2626' : n.is_current ? '#1e40af' : '#6b7280'
        ctx.fillText(n.label, p.x, p.y + r + 10)
      }
    }

    function tick() {
      simulate()
      draw()
      if (iterRef.current < 250) {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }
    tick()

    return () => cancelAnimationFrame(animFrameRef.current)
  }, [data])

  // Handle mouse hover for tooltips
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setMousePos({ x: e.clientX, y: e.clientY })

    let found: GraphNode | null = null
    for (const n of data.nodes) {
      const p = positionsRef.current.get(n.id)
      if (!p) continue
      const r = n.is_current ? 22 : n.type !== 'claim' ? 18 : 10
      const dx = mx - p.x, dy = my - p.y
      if (dx * dx + dy * dy < (r + 5) * (r + 5)) {
        found = n
        break
      }
    }
    setHoveredNode(found)
  }

  const tooltipContent = (n: GraphNode) => {
    if (n.type === 'claim') {
      const fraud = (n.fraud_flag || 0) >= 1
      return (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{n.label} {n.is_current ? '(Current)' : ''}</div>
          <div>Amount: ${(n.amount || 0).toLocaleString()}</div>
          <div>Fraud: <span style={{ color: fraud ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{fraud ? 'Yes' : 'No'}</span></div>
          {n.garage && <div>Garage: {n.garage}</div>}
          {n.broker && <div>Broker: {n.broker}</div>}
        </div>
      )
    }
    if (n.type === 'garage' || n.type === 'broker') {
      const rate = ((n.fraud_rate || 0) * 100).toFixed(0)
      return (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{n.label}</div>
          <div>Type: {n.type.charAt(0).toUpperCase() + n.type.slice(1)}</div>
          <div>Total Claims: {n.total_claims || 0}</div>
          <div>Fraud Rate: <span style={{ color: (n.fraud_rate || 0) > 0.4 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{rate}%</span></div>
        </div>
      )
    }
    if (n.type === 'customer') {
      return (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{n.label}</div>
          <div>Past Claims: {n.past_claims || 0}</div>
          <div>Prior Fraud: <span style={{ color: (n.prior_fraud || 0) > 0 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{n.prior_fraud || 0}</span></div>
        </div>
      )
    }
    if (n.type === 'zip') {
      const rate = ((n.fraud_rate || 0) * 100).toFixed(0)
      return (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{n.label}</div>
          <div>Claims in Area: {n.total_claims || 0}</div>
          <div>Fraud Rate: {rate}%</div>
        </div>
      )
    }
    return <div>{n.label}</div>
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(920px, 94vw)', height: 'min(700px, 88vh)',
        background: '#fff', borderRadius: '16px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#312e81 0%,#4f46e5 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 7.5l3 7M15.5 7.5l-3 7M7 4h10"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Fraud Ring Network</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>{data.nodes.length} nodes · {data.edges.length} connections · {fraudClaims}/{totalClaims} linked claims flagged</div>
          </div>
          {riskPct < 33 ? (
            <span title="Risk level" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#16a34a', padding: '3px 10px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              Low Risk
            </span>
          ) : riskPct < 66 ? (
            <span title="Risk level" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#d97706', padding: '3px 10px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2L2 22h20L12 2z"/></svg>
              Moderate
            </span>
          ) : (
            <span title="Risk level" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '3px 10px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>
              High Risk
            </span>
          )}
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Graph Canvas */}
          <div style={{ flex: 1, position: 'relative', background: '#fafbfc' }}>
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ width: '100%', height: '100%', cursor: hoveredNode ? 'pointer' : 'default' }}
            />
            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.95)', borderRadius: '10px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Legend</div>
              {[
                { color: '#3b82f6', label: 'Claims', shape: 'circle' },
                { color: '#ef4444', label: 'Fraud-flagged', shape: 'circle' },
                { color: '#f59e0b', label: 'Garage', shape: 'circle' },
                { color: '#6366f1', label: 'Broker', shape: 'circle' },
                { color: '#10b981', label: 'Customer', shape: 'circle' },
                { color: '#a855f7', label: 'ZIP Code', shape: 'circle' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '9px', color: '#4b5563' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Tooltip */}
            {hoveredNode && (
              <div style={{
                position: 'fixed', left: mousePos.x + 14, top: mousePos.y - 10,
                background: '#1e293b', color: '#f1f5f9', borderRadius: '8px',
                padding: '8px 12px', fontSize: '11px', lineHeight: 1.5,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 400,
                pointerEvents: 'none', maxWidth: 220,
              }}>
                {tooltipContent(hoveredNode)}
              </div>
            )}
          </div>

          {/* Right sidebar: findings */}
          <div style={{ width: 260, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Summary</div>
              <div style={{ fontSize: '11px', color: '#374151', lineHeight: 1.5 }}>{summary}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Network Findings</div>
              {findings.map((f, i) => {
                const isFlag = !f.includes('No significant')
                return (
                  <div key={i} style={{
                    padding: '8px 10px', marginBottom: 6, borderRadius: '6px',
                    border: `1px solid ${isFlag ? '#fecaca' : '#e5e7eb'}`,
                    background: isFlag ? '#fef2f2' : '#f9fafb',
                  }}>
                    <div style={{ fontSize: '11px', color: isFlag ? '#991b1b' : '#4b5563', lineHeight: 1.4 }}>
                      {isFlag ? '⚠ ' : '✓ '}{f}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Stats bar */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Nodes', val: data.nodes.length },
                { label: 'Edges', val: data.edges.length },
                { label: 'Fraud Claims', val: fraudClaims },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{s.val}</div>
                  <div style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ══════════════ LOSS CAUSE DETAILS MODAL ══════════════ */
const LossCauseDetailsModal = ({ data, onClose, onPreviewImage }: { data: Record<string, unknown>; onClose: () => void; onPreviewImage: (url: string) => void }) => {
  const inputData = (data._input_data as Record<string, string>) || {}

  const dataSections = [
    { label: 'Claim Notes', value: inputData.claim_notes, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '📝' },
    { label: 'Image Analysis', value: inputData.image_summary, color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', icon: '🖼️' },
    { label: 'PDF Summary', value: inputData.pdf_summary, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', icon: '📄' },
    { label: 'Handwritten Notes', value: inputData.hwn_summary, color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: '✍️' },
  ].filter(s => s.value && s.value.trim() && s.value.toLowerCase() !== 'nan')

  const metaFields = [
    { label: 'LOB', value: inputData.lob },
    { label: 'Claim Date', value: inputData.claim_date },
    { label: 'Claim Amount', value: inputData.claim_amount },
    { label: 'Weather', value: inputData.weather },
  ].filter(m => m.value != null && String(m.value).trim() && String(m.value).toLowerCase() !== 'nan')

  // Image URLs from claim_image
  const imageStr = inputData.claim_image || ''
  const imageUrls = imageStr ? imageStr.split(',').filter(p => p.trim() && !['nan', 'none'].includes(p.trim().toLowerCase())).map(p => {
    const name = p.trim().split(/[/\\]/).pop() || ''
    return `/api/uploads/${name}`
  }) : []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px, 92vw)', maxHeight: '85vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#4c1d95 0%,#6d28d9 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BrainSvg /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Loss Cause Agent — Input Data</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Claim notes & attachments</div>
          </div>
          <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Metadata fields */}
          {metaFields.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {metaFields.map(m => (
                <span key={m.label} style={{ fontSize: '10px', padding: '3px 8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '4px', color: '#374151' }}>
                  <strong>{m.label}:</strong> {m.value}
                </span>
              ))}
            </div>
          )}

          {/* Data sections (claim notes first) */}
          {dataSections.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.icon} {s.label}</div>
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: s.bg, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, fontSize: '11px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                {s.value}
              </div>
            </div>
          ))}

          {/* Attached images (clickable) */}
          {imageUrls.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Attached Images ({imageUrls.length})</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {imageUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Attachment ${i + 1}`} onClick={() => onPreviewImage(url)} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════ STRUCTURED DETAILS MODAL ══════════════ */
const StructuredDetailsModal = ({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) => {
  const prob = (data.ml_fraud_probability as number) || 0
  const risk = (data.risk_level as string) || 'UNKNOWN'
  const input = (data.input_summary as Record<string, unknown>) || {}
  const numFeats = (input.numeric_features as string[]) || []
  const textFeats = (input.text_features as string[]) || []
  const model = (input.model as string) || 'XGBoost'
  const riskBg = risk === 'CRITICAL' ? '#dc2626' : risk === 'HIGH' ? '#ea580c' : risk === 'MEDIUM' ? '#d97706' : '#16a34a'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(600px, 92vw)', maxHeight: '82vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#1e293b 0%,#334155 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DataSvg /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>ML Model Details</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{model}</div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: riskBg, padding: '3px 9px', borderRadius: '10px' }}>{risk}</span>
          <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {numFeats.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Numeric Features ({numFeats.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {numFeats.map(f => <span key={f} style={{ fontSize: '10px', padding: '3px 8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '4px', color: '#374151', fontFamily: 'ui-monospace,monospace' }}>{f}</span>)}
              </div>
            </div>
          )}
          {textFeats.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Text Features ({textFeats.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {textFeats.map(f => <span key={f} style={{ fontSize: '10px', padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', color: '#1e40af', fontFamily: 'ui-monospace,monospace' }}>{f}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════ DOCUMENT DETAILS MODAL ══════════════ */
const DocumentDetailsModal = ({ data, onClose, onPreviewImage }: { data: Record<string, unknown>; onClose: () => void; onPreviewImage: (url: string) => void }) => {
  const riskScore = (data.risk_score as number) || 0
  const riskLevel = (data.risk_level as string) || 'UNKNOWN'
  const findings = (data.findings as Array<{ category: string; severity: string; description: string }>) || []
  const summary = (data.summary as string) || ''
  const recommendation = (data.recommendation as string) || ''
  const input = (data.input_summary as Record<string, unknown>) || {}
  const sections = (input.sections_analyzed as Record<string, boolean>) || {}
  const model = (input.model as string) || 'LLM'
  const rawData = (input.raw_data as Record<string, string>) || {}
  const reasoningTrace = (data.reasoning_trace as string) || ''
  const docImageUrls = (input.image_urls as string[]) || []
  const docPdfUrls = (input.pdf_urls as string[]) || []
  const [showReasoning, setShowReasoning] = useState(false)
  const [showRawData, setShowRawData] = useState(false)

  const highFindings = findings.filter(f => f.severity === 'high')
  const medFindings = findings.filter(f => f.severity === 'medium')
  const lowFindings = findings.filter(f => f.severity === 'low')

  const riskBg = riskScore >= 66 ? '#dc2626' : riskScore >= 33 ? '#d97706' : '#16a34a'
  const recBg = recommendation === 'ESCALATE' ? '#dc2626' : recommendation === 'FLAG_FOR_REVIEW' ? '#d97706' : '#16a34a'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(720px, 92vw)', maxHeight: '85vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#7c2d12 0%,#9a3412 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocSvg /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Document Agent Analysis</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{model} · {findings.length} findings</div>
          </div>
          {riskScore < 33 ? (
            <span title={`Risk: ${riskScore}/100`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#16a34a', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              Low Risk
            </span>
          ) : riskScore < 66 ? (
            <span title={`Risk: ${riskScore}/100`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#d97706', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2L2 22h20L12 2z"/></svg>
              Moderate
            </span>
          ) : (
            <span title={`Risk: ${riskScore}/100`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '3px 9px', borderRadius: '10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>
              High Risk
            </span>
          )}
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: recBg, padding: '3px 9px', borderRadius: '10px' }}>{recommendation.replace(/_/g, ' ')}</span>
          <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Data sources */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Data Sources Analyzed</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'claim_notes', label: 'Claim Notes' },
                { key: 'pdf_summary', label: 'PDF Documents' },
                { key: 'handwritten_notes', label: 'Handwritten Notes' },
                { key: 'accident_images', label: 'Accident Images' },
              ].map(s => (
                <span key={s.key} style={{
                  fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
                  background: sections[s.key] ? '#d1fae5' : '#f3f4f6',
                  color: sections[s.key] ? '#065f46' : '#9ca3af',
                  border: `1px solid ${sections[s.key] ? '#6ee7b7' : '#e5e7eb'}`,
                }}>{sections[s.key] ? '✓' : '—'} {s.label}</span>
              ))}
            </div>
          </div>

          {/* Claim Images */}
          {docImageUrls.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Accident Images Analyzed ({docImageUrls.length})</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {docImageUrls.map((url, i) => (
                  <div key={i} onClick={() => onPreviewImage(url)} style={{ cursor: 'pointer' }}>
                    <img src={url} alt={`Claim ${i + 1}`} style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#ea580c')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Documents */}
          {docPdfUrls.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>PDF Documents Analyzed ({docPdfUrls.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {docPdfUrls.map((url, i) => (
                  <div key={i} style={{ borderRadius: '10px', border: '1px solid #c7d2fe', overflow: 'hidden', backgroundColor: '#f8faff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#eef2ff', borderBottom: '1px solid #e0e7ff' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeURIComponent(url.split('/').pop() || `Document ${i + 1}`)}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}>Open ↗</a>
                    </div>
                    <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`} title={`PDF ${i + 1}`} style={{ width: '100%', height: '250px', border: 'none', display: 'block', background: '#fff' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Data Processed */}
          {Object.values(rawData).some(v => v && v.trim()) && (
            <div>
              <button onClick={() => setShowRawData(!showRawData)} style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                Raw Data Processed
                <span style={{ transform: showRawData ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
              </button>
              {showRawData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'claim_notes', label: 'Claim Notes', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                    { key: 'pdf_summary', label: 'PDF Summary', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                    { key: 'handwritten_notes', label: 'Handwritten Notes', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
                    { key: 'image_summary', label: 'Image Description', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
                  ].filter(s => rawData[s.key] && rawData[s.key].trim()).map(s => (
                    <div key={s.key}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{s.label}</div>
                      <div style={{ padding: '8px 12px', borderRadius: '6px', background: s.bg, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, fontSize: '11px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                        {rawData[s.key]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>{summary}</div>
            </div>
          )}

          {/* Document Inconsistency Findings */}
          {findings.length > 0 && (
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '2px', borderBottom: '2px solid #ea580c', marginBottom: '-6px' }}>Document Inconsistency</div>
          )}
          {highFindings.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>High Severity ({highFindings.length})</div>
              {highFindings.map((f, i) => (
                <div key={i} style={{ padding: '8px 12px', marginBottom: '4px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '3px solid #dc2626' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 5px', borderRadius: '3px', marginRight: '6px' }}>{f.category.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '11px', color: '#7f1d1d', lineHeight: 1.5 }}>{f.description}</span>
                </div>
              ))}
            </div>
          )}
          {medFindings.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Medium Severity ({medFindings.length})</div>
              {medFindings.map((f, i) => (
                <div key={i} style={{ padding: '8px 12px', marginBottom: '4px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #d97706' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '1px 5px', borderRadius: '3px', marginRight: '6px' }}>{f.category.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '11px', color: '#78350f', lineHeight: 1.5 }}>{f.description}</span>
                </div>
              ))}
            </div>
          )}
          {lowFindings.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Low Severity ({lowFindings.length})</div>
              {lowFindings.map((f, i) => (
                <div key={i} style={{ padding: '8px 12px', marginBottom: '4px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '3px solid #3b82f6' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#3b82f6', background: '#dbeafe', padding: '1px 5px', borderRadius: '3px', marginRight: '6px' }}>{f.category.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '11px', color: '#1e3a5f', lineHeight: 1.5 }}>{f.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reasoning trace */}
          {reasoningTrace && (
            <div>
              <button onClick={() => setShowReasoning(!showReasoning)} style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                LLM Reasoning Trace
                <span style={{ transform: showReasoning ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
              </button>
              {showReasoning && (
                <div style={{ marginTop: '6px', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px', color: '#4b5563', lineHeight: 1.6, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {reasoningTrace}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════ VISUAL DETAILS MODAL ══════════════ */
const VisualDetailsModal = ({ data, onClose, onPreviewImage }: { data: Record<string, unknown>; onClose: () => void; onPreviewImage: (url: string) => void }) => {
  const imageUrls = (data.image_urls as string[]) || []
  const aiClass = (data.ai_classification as string) || 'N/A'
  const aiProb = (data.ai_probability as number) || 0
  const aiConf = (data.ai_confidence_label as string) || ''
  const rsStatus = (data.reverse_search_status as string) || 'skipped'
  const rsFound = data.available_on_internet as boolean
  const fullMatches = (data.full_match_links as string[]) || []
  const partialMatches = (data.partial_match_links as string[]) || []
  const pagesWithImage = (data.pages_with_image as string[]) || []
  const imgDesc = (data.image_description as string) || ''
  const visStatus = (data.status as string) || 'unknown'
  const [showAllLinks, setShowAllLinks] = useState(false)

  const earliestDate = (data.earliest_online_date as string) || ''
  const aiColor = aiClass === 'Real' ? '#16a34a' : aiClass === 'AI Generated' ? '#dc2626' : '#d97706'
  const aiBg = aiClass === 'Real' ? '#f0fdf4' : aiClass === 'AI Generated' ? '#fef2f2' : '#fffbeb'
  const aiBorder = aiClass === 'Real' ? '#86efac' : aiClass === 'AI Generated' ? '#fecaca' : '#fcd34d'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(700px, 92vw)', maxHeight: '85vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImgSvg /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Visual Agent Analysis</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{imageUrls.length} image(s) analyzed</div>
          </div>
          {visStatus === 'completed' && <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: aiColor, padding: '3px 9px', borderRadius: '10px' }}>{aiClass}</span>}
          <button onClick={onClose} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Images */}
          {imageUrls.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Analyzed Images</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {imageUrls.map((url, i) => (
                  <div key={i} onClick={() => onPreviewImage(url)} style={{ cursor: 'pointer' }}>
                    <img src={url} alt={`Evidence ${i + 1}`} style={{ width: '160px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predates claim warning */}
          {earliestDate && rsFound && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Image Found Online — Earliest: {earliestDate}</div>
                <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>This image appeared online before the claim was filed, suggesting possible use of stock or stolen imagery.</div>
              </div>
            </div>
          )}

          {/* Results grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* AI Detection */}
            <div style={{ background: aiBg, border: `1px solid ${aiBorder}`, borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>AI Detection</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: aiColor }}>{aiClass}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Probability: {Math.round(aiProb * 100)}% · Confidence: {aiConf}</div>
            </div>
            {/* Reverse Search */}
            <div style={{ background: rsFound ? '#fffbeb' : '#f0fdf4', border: `1px solid ${rsFound ? '#fcd34d' : '#86efac'}`, borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Reverse Image Search</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: rsFound ? '#d97706' : '#16a34a' }}>{rsStatus === 'completed' ? (rsFound ? 'Found Online' : 'Not Found') : rsStatus}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {fullMatches.length} full · {partialMatches.length} partial matches
                {earliestDate && <span style={{ marginLeft: '6px', color: '#dc2626', fontWeight: 600 }}>· Earliest: {earliestDate}</span>}
              </div>
            </div>
          </div>

          {/* Reverse Image Search Links */}
          {(fullMatches.length > 0 || partialMatches.length > 0 || pagesWithImage.length > 0) && (
            <div>
              <button onClick={() => setShowAllLinks(!showAllLinks)} style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                Online Sources Found ({fullMatches.length + partialMatches.length + pagesWithImage.length} links)
                <span style={{ transform: showAllLinks ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
              </button>
              {showAllLinks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {fullMatches.length > 0 && (
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Full Matches ({fullMatches.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {fullMatches.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#1d4ed8', textDecoration: 'none', padding: '4px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', wordBreak: 'break-all', display: 'block' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                            {url.length > 80 ? url.slice(0, 80) + '...' : url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {partialMatches.length > 0 && (
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Partial Matches ({partialMatches.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {partialMatches.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#1d4ed8', textDecoration: 'none', padding: '4px 8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', wordBreak: 'break-all', display: 'block' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                            {url.length > 80 ? url.slice(0, 80) + '...' : url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {pagesWithImage.length > 0 && (
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Pages With This Image ({pagesWithImage.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {pagesWithImage.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#1d4ed8', textDecoration: 'none', padding: '4px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', wordBreak: 'break-all', display: 'block' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                            {url.length > 80 ? url.slice(0, 80) + '...' : url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image description */}
          {imgDesc && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>LLM Image Description</div>
              <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#334155', lineHeight: 1.6 }}>{imgDesc}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════
   MINI NETWORK DIAGRAM (floating thumbnail)
   ══════════════════════════════════════════════════ */
export const MiniNetworkDiagram = ({ events, isProcessing, onClick }: { events: { agent: string; type: string }[]; isProcessing: boolean; onClick: () => void }) => {
  const hasEv   = (ag: string) => events.some(e => e.agent === ag)
  const isDone  = (ag: string) => events.some(e => e.agent === ag && e.type === 'result')
  const hasType = (ag: string, t: string) => events.some(e => e.agent === ag && e.type === t)

  type NS = 'pending' | 'active' | 'done'
  const nodeState = (ag: string): NS => {
    if (isDone(ag)) return 'done'
    if (hasEv(ag) && isProcessing) return 'active'
    if (hasEv(ag)) return 'done'
    return 'pending'
  }
  const claimState: NS   = events.length > 0 ? 'done' : isProcessing ? 'active' : 'pending'
  const verdictState: NS = isDone('adjudicator') ? 'done' : nodeState('adjudicator') === 'active' ? 'active' : 'pending'
  const lcDbState: NS    = hasType('loss_cause', 'tool_use') ? 'active' : isDone('loss_cause') ? 'done' : 'pending'

  /* ── Layout — viewBox 1100×200, centerline y=100 ── */
  const CY = 100                          // main flow centerline
  const PY = [30, 60, 90, 120, 150]       // 5 parallel agents, 30px spacing

  const nodes: { x: number; y: number; state: NS; label: string; small?: boolean }[] = [
    // Main horizontal flow
    { x: 80,  y: CY,    state: claimState,               label: 'C' },
    { x: 210, y: CY,    state: nodeState('pii_masking'),  label: 'P' },
    { x: 355, y: CY,    state: nodeState('loss_cause'),   label: 'L' },
    // Parallel agents
    { x: 545, y: PY[0], state: nodeState('structured'),   label: 'M' },
    { x: 545, y: PY[1], state: nodeState('document'),     label: 'D' },
    { x: 545, y: PY[2], state: nodeState('visual'),       label: 'V' },
    { x: 545, y: PY[3], state: nodeState('web_search'),   label: 'W' },
    { x: 545, y: PY[4], state: nodeState('fraud_ring'),   label: 'F' },
    // End flow
    { x: 800, y: CY,    state: nodeState('adjudicator'),  label: 'A' },
    { x: 980, y: CY,    state: verdictState,              label: 'R' },
    // Sub-nodes (small)
    { x: 355, y: 22,    state: 'pending' as NS,           label: 'Cht', small: true },
    { x: 355, y: 178,   state: lcDbState,                 label: 'Db',  small: true },
    { x: 800, y: 22,    state: 'pending' as NS,           label: 'Cht', small: true },
  ]

  /* ── Edge paths ── */
  interface MiniEdge { d: string; done: boolean; chat?: boolean; bidir?: boolean }
  const NW = 48  // half node width for edge endpoints
  const edges: MiniEdge[] = [
    // Main horizontal
    { d: `M${80+NW},${CY} L${210-NW},${CY}`,  done: hasEv('pii_masking') },
    { d: `M${210+NW},${CY} L${355-NW},${CY}`, done: hasEv('loss_cause') },
    // Fan-out from Loss Cause
    { d: `M${355+NW},${CY} C${420},${CY} ${460},${PY[0]} ${545-NW},${PY[0]}`, done: hasEv('structured') },
    { d: `M${355+NW},${CY} C${420},${CY} ${460},${PY[1]} ${545-NW},${PY[1]}`, done: hasEv('document') },
    { d: `M${355+NW},${CY} L${545-NW},${CY}`,                                  done: hasEv('visual') },
    { d: `M${355+NW},${CY} C${420},${CY} ${460},${PY[3]} ${545-NW},${PY[3]}`, done: hasEv('web_search') },
    { d: `M${355+NW},${CY} C${420},${CY} ${460},${PY[4]} ${545-NW},${PY[4]}`, done: hasEv('fraud_ring') },
    // Fan-in to Adjudicator
    { d: `M${545+NW},${PY[0]} C${630},${PY[0]} ${710},${CY} ${800-NW},${CY}`, done: isDone('adjudicator') },
    { d: `M${545+NW},${PY[1]} C${630},${PY[1]} ${710},${CY} ${800-NW},${CY}`, done: isDone('adjudicator') },
    { d: `M${545+NW},${CY} L${800-NW},${CY}`,                                  done: isDone('adjudicator') },
    { d: `M${545+NW},${PY[3]} C${630},${PY[3]} ${710},${CY} ${800-NW},${CY}`, done: isDone('adjudicator') },
    { d: `M${545+NW},${PY[4]} C${630},${PY[4]} ${710},${CY} ${800-NW},${CY}`, done: isDone('adjudicator') },
    // Adjudicator → Verdict
    { d: `M${800+NW},${CY} L${980-NW},${CY}`, done: isDone('adjudicator') },
    // Sub-node edges
    { d: `M355,${CY - 11} L355,35`,  done: false, chat: true },
    { d: `M355,${CY + 11} L355,169`, done: lcDbState !== 'pending', bidir: true },
    { d: `M800,${CY - 11} L800,35`,  done: false, chat: true },
  ]

  /* Full labels — matching the full monitoring panel */
  const nodeLabels: Record<string, string> = {
    C: 'Claim Input', P: 'PII Masking', L: 'Loss Cause Agent', M: 'ML Model',
    D: 'Document Agent', V: 'Visual Agent', W: 'Web Search', F: 'Fraud Ring',
    A: 'Adjudicator', R: 'Final Verdict', Cht: 'Follow-up Chat', Db: 'DB Lookup'
  }

  return (
    <div
      onClick={onClick}
      title="Click to open full Agent Monitoring dashboard"
      style={{
        width: '100%', height: '185px',
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        cursor: 'pointer', overflow: 'hidden',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.14)'; e.currentTarget.style.borderColor = ORANGE + '60' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#e5e7eb' }}
    >
      <svg viewBox="0 0 1100 200" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="mnGradDone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0fdf4"/><stop offset="100%" stopColor="#dcfce7"/>
          </linearGradient>
          <linearGradient id="mnGradActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff7ed"/><stop offset="100%" stopColor="#ffedd5"/>
          </linearGradient>
          <linearGradient id="mnGradPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9fafb"/><stop offset="100%" stopColor="#f3f4f6"/>
          </linearGradient>
          <filter id="mnShadow" x="-8%" y="-8%" width="116%" height="126%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0000000d"/>
          </filter>
          <filter id="mnGlowActive" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/>
            <feFlood floodColor={ORANGE} floodOpacity="0.2" result="c"/>
            <feComposite in="c" in2="b" operator="in" result="g"/>
            <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="mnGlowDone" x="-12%" y="-12%" width="124%" height="124%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="b"/>
            <feFlood floodColor="#16a34a" floodOpacity="0.15" result="c"/>
            <feComposite in="c" in2="b" operator="in" result="g"/>
            <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <marker id="mnArr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#16a34a" opacity="0.7"/>
          </marker>
          <marker id="mnArrGray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#d1d5db" opacity="0.5"/>
          </marker>
          <marker id="mnArrUp" markerWidth="6" markerHeight="5" refX="3" refY="0" orient="auto">
            <path d="M0,5 L3,0 L6,5" fill="none" stroke="#3b82f6" strokeWidth={1} opacity="0.6"/>
          </marker>
        </defs>

        {/* Parallel execution zone */}
        <rect x={490} y={14} width={110} height={172} rx={8}
          fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.7} strokeDasharray="6 3" opacity={0.6}/>
        <text x={545} y={195} textAnchor="middle" fontSize="6.5" fill="#94a3b8" fontWeight="600" letterSpacing="0.8"
          fontFamily="ui-sans-serif,system-ui,sans-serif">PARALLEL EXECUTION</text>

        {/* Edges */}
        {edges.map((e, i) => {
          const isChat = e.chat
          const isBidir = e.bidir
          const strokeCol = e.done ? '#16a34a' : isChat ? '#9ca3af' : isBidir ? '#3b82f6' : '#d1d5db'
          const dash = e.done ? 'none' : isChat ? '4 3' : isBidir ? '5 3' : '6 4'
          const sw = e.done ? 1.8 : isChat ? 0.8 : 1
          const arrow = isChat ? undefined : isBidir ? undefined : e.done ? 'url(#mnArr)' : 'url(#mnArrGray)'
          return (
            <g key={`e${i}`}>
              {e.done && !isChat && <path d={e.d} fill="none" stroke="#16a34a" strokeWidth={4} opacity={0.08} strokeLinecap="round"/>}
              <path d={e.d} fill="none" stroke={strokeCol} strokeWidth={sw}
                strokeDasharray={dash} strokeLinecap="round" markerEnd={arrow}
                opacity={isChat ? 0.5 : 1}
              >
                {!e.done && !isChat && hasEv('loss_cause') && (
                  <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite"/>
                )}
              </path>
              {/* Bidirectional arrows for DB Lookup */}
              {isBidir && (
                <>
                  <polygon points="355,170 352,164 358,164" fill="#3b82f6" opacity="0.5"/>
                  <polygon points="355,110 352,116 358,116" fill="#3b82f6" opacity="0.5"/>
                </>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const isSmall = n.small
          const w = isSmall ? 70 : 96, h = isSmall ? 18 : 22, rx = isSmall ? 5 : 7
          const iconR = isSmall ? 5.5 : 7
          const iconX = n.x - w / 2 + iconR + (isSmall ? 3 : 5)
          const textX = iconX + iconR + (isSmall ? 3 : 5)
          const borderCol = n.state === 'done' ? '#86efac' : n.state === 'active' ? '#fb923c' : isSmall ? '#c7d2fe' : '#d1d5db'
          const iconCol = n.state === 'done' ? '#16a34a' : n.state === 'active' ? ORANGE : isSmall ? '#6366f1' : '#94a3b8'
          const filterVal = n.state === 'active' ? 'url(#mnGlowActive)' : n.state === 'done' ? 'url(#mnGlowDone)' : 'url(#mnShadow)'
          return (
            <g key={i}>
              <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={rx}
                fill={`url(#mnGrad${n.state === 'done' ? 'Done' : n.state === 'active' ? 'Active' : 'Pending'})`}
                stroke={borderCol} strokeWidth={n.state === 'active' ? 1.5 : 0.8}
                filter={filterVal} opacity={isSmall && n.state === 'pending' ? 0.7 : 1}
              />
              {n.state === 'active' && (
                <rect x={n.x - w / 2 - 2} y={n.y - h / 2 - 2} width={w + 4} height={h + 4} rx={rx + 2}
                  fill="none" stroke={ORANGE} strokeWidth={1}>
                  <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite"/>
                </rect>
              )}
              <circle cx={iconX} cy={n.y} r={iconR}
                fill={iconCol} opacity={n.state === 'pending' ? 0.5 : 1}
              />
              <text x={iconX} y={n.y + (isSmall ? 2.5 : 3)} textAnchor="middle" fontSize={isSmall ? '5.5' : '7'} fontWeight="700"
                fill="#fff" fontFamily="ui-sans-serif,system-ui,sans-serif">
                {n.label.charAt(0)}
              </text>
              <text x={textX} y={n.y + (isSmall ? 2.5 : 3)} fontSize={isSmall ? '5.5' : '7'} fontWeight="600"
                fill={isSmall ? '#6b7280' : '#374151'} fontFamily="ui-sans-serif,system-ui,sans-serif">
                {nodeLabels[n.label]}
              </text>
            </g>
          )
        })}

        {/* Merge point pulse */}
        {isProcessing && (isDone('structured') || isDone('document') || isDone('visual') || isDone('web_search') || isDone('fraud_ring')) && !isDone('adjudicator') && (
          <circle cx={770} cy={CY} r={4} fill="none" stroke={ORANGE} strokeWidth={1}>
            <animate attributeName="r" values="4;10;4" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite"/>
          </circle>
        )}
      </svg>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function AgentsPage({ claimId: _claimId, isProcessing, events, verdict, onNewClaim: _onNewClaim, onOpenMonitoring, authToken }: AgentsPageProps) {
  void _claimId; void _onNewClaim

  /* Event grouping */
  const lossCauseEv  = events.filter(e => e.agent === 'loss_cause')
  const structuredEv = events.filter(e => e.agent === 'structured')
  const documentEv   = events.filter(e => e.agent === 'document')
  const visualEv     = events.filter(e => e.agent === 'visual')
  const webSearchEv  = events.filter(e => e.agent === 'web_search')
  const fraudRingEv  = events.filter(e => e.agent === 'fraud_ring')
  const adjEv        = events.filter(e => e.agent === 'adjudicator')

  const isDone = (ag: string) => events.some(e => e.agent === ag && e.type === 'result')
  const isActive = (ag: string) => isProcessing && events.some(e => e.agent === ag) && !isDone(ag)

  // Orchestrator-computed risk levels (authoritative — factors in date comparison etc.)
  const agentRiskLevels = verdict?.agent_risk_levels || {}

  const allSubDone = isDone('structured') && isDone('document') && isDone('visual') && isDone('web_search') && isDone('fraud_ring')
  const anySubActive = isActive('structured') || isActive('document') || isActive('visual') || isActive('web_search') || isActive('fraud_ring')

  /* Augmented event arrays — append reasoning/summary as chat bubbles */
  const lossCauseEvAug = useMemo(() => {
    if (!isDone('loss_cause')) return lossCauseEv
    const resultEv = lossCauseEv.find(e => e.type === 'result')
    const d = resultEv?.data as Record<string, unknown> | undefined
    const reasoning = d?.reasoning as string | undefined
    const summary = d?.claim_summary as string | undefined
    if (!reasoning && !summary) return lossCauseEv
    const parts: string[] = []
    if (reasoning) parts.push(`Reasoning: ${reasoning}`)
    if (summary) parts.push(`Summary: ${summary}`)
    return [...lossCauseEv, { timestamp: '', agent: 'loss_cause', type: 'result' as const, content: parts.join('\n\n'), data: { _isSummary: true } }]
  }, [lossCauseEv, events])

  const adjEvAug = useMemo(() => {
    if (!isDone('adjudicator') || !verdict) return adjEv
    const vLabel = verdict.fraud_verdict === 'SIU' ? 'SIU — Special Investigation Unit Referral'
      : verdict.fraud_verdict === 'REJECT' ? 'SIU — Send to Special Investigation Unit'
      : verdict.fraud_verdict === 'MANUAL REVIEW' || verdict.fraud_verdict === 'FLAG' ? 'MANUAL REVIEW — Requires Human Review'
      : 'AUTO APPROVE — Low Risk'
    const parts = [`Verdict: ${vLabel}`]
    if (verdict.executive_summary) {
      parts.push(verdict.executive_summary)
    } else if (verdict.reasoning) {
      const cleaned = verdict.reasoning
        .replace(/^#{1,3}\s+.+$/gm, '')
        .replace(/^\*\*[^*]+\*\*\s*$/gm, '')
        .replace(/^\s*\n/gm, '\n')
        .trim()
      const paragraphs = cleaned.split('\n\n').filter(p => p.trim())
      const snippet = paragraphs.slice(0, 3).join('\n\n')
      parts.push(snippet.length > 500 ? snippet.slice(0, 500).replace(/\s+\S*$/, '') + '...' : snippet)
    }
    return [...adjEv, { timestamp: '', agent: 'adjudicator', type: 'result' as const, content: parts.join('\n\n'), data: { _isSummary: true } }]
  }, [adjEv, verdict, events])

  const [showTaxonomy, setShowTaxonomy] = useState(false)
  const [showWsResults, setShowWsResults] = useState(false)
  const [showFraudNetwork, setShowFraudNetwork] = useState(false)
  const [showStructuredDetails, setShowStructuredDetails] = useState(false)
  const [showDocumentDetails, setShowDocumentDetails] = useState(false)
  const [showVisualDetails, setShowVisualDetails] = useState(false)
  const [showLossCauseDetails, setShowLossCauseDetails] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [showAdjExpandedChat, setShowAdjExpandedChat] = useState(false)

  const [lcChatMessages, setLcChatMessages] = useState<{ role: string, content: string }[]>([])
  const [isLcChatLoading, setIsLcChatLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const lcAbortControllerRef = useRef<AbortController | null>(null)


  const handleSendLC = async (message: string) => {
    if (!_claimId) return

    // Add user message to local state
    setLcChatMessages(prev => [...prev, { role: 'user', content: message }])
    setIsLcChatLoading(true)
    setStreamingContent('')

    // Create abort controller for cancellation
    lcAbortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/loss_cause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ claim_id: _claimId, message }),
        signal: lcAbortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Check if response is streaming
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') break
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.token) {
                    fullContent += parsed.token
                    setStreamingContent(fullContent)
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        // Add final response to chat
        setLcChatMessages(prev => [...prev, {
          role: 'assistant',
          content: fullContent
        }])
      } else {
        // Handle non-streaming response
        const data = await response.json()
        setLcChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response
        }])
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled by user
        setLcChatMessages(prev => [...prev, {
          role: 'assistant',
          content: '[Response stopped by user]'
        }])
      } else {
        console.error('Loss Cause Chat error:', error)
        setLcChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your question. Please try again.'
        }])
      }
    } finally {
      setIsLcChatLoading(false)
      setStreamingContent('')
      lcAbortControllerRef.current = null
    }
  }

  const handleCancelLC = () => {
    if (lcAbortControllerRef.current) {
      lcAbortControllerRef.current.abort()
    }
  }

  const [adjChatMessages, setAdjChatMessages] = useState<{ role: string, content: string }[]>([])
  const [isAdjChatLoading, setIsAdjChatLoading] = useState(false)
  const [adjStreamingContent, setAdjStreamingContent] = useState('')
  const adjAbortControllerRef = useRef<AbortController | null>(null)

  // Reset chat messages when switching claims or rerunning the same claim
  const prevClaimRef = useRef<string | null>(null)
  const prevProcessingRef = useRef(false)
  useEffect(() => {
    const isNewClaim = _claimId !== prevClaimRef.current
    const isRerun = isProcessing && !prevProcessingRef.current && events.length === 0
    if (isNewClaim || isRerun) {
      prevClaimRef.current = _claimId
      setLcChatMessages([])
      setAdjChatMessages([])
    }
    prevProcessingRef.current = isProcessing
  }, [_claimId, isProcessing, events.length])

  const handleSendAdj = async (message: string) => {
    if (!_claimId) return
    setAdjChatMessages(prev => [...prev, { role: 'user', content: message }])
    setIsAdjChatLoading(true)
    setAdjStreamingContent('')
    adjAbortControllerRef.current = new AbortController()
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/adjudicator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ claim_id: _claimId, message }),
        signal: adjAbortControllerRef.current.signal
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') break
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.token) { fullContent += parsed.token; setAdjStreamingContent(fullContent) }
                } catch (_) { /* ignore */ }
              }
            }
          }
        }
        setAdjChatMessages(prev => [...prev, { role: 'assistant', content: fullContent }])
      } else {
        const data = await response.json()
        setAdjChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      }
    } catch (error) {
      setAdjChatMessages(prev => [...prev, { role: 'assistant', content: (error as Error).name === 'AbortError' ? '[Response stopped]' : 'Sorry, encountered an error. Please try again.' }])
    } finally {
      setIsAdjChatLoading(false)
      setAdjStreamingContent('')
      adjAbortControllerRef.current = null
    }
  }

  const handleCancelAdj = () => { adjAbortControllerRef.current?.abort() }

  // Load saved chat history when viewing a saved report (not processing)
  useEffect(() => {
    if (!_claimId || isProcessing || !authToken) return
    const loadChats = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/claims/${_claimId}/chat-history`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const msgs: { role: string; content: string; user_email?: string; user_name?: string; agent?: string; created_at?: string }[] = data.messages || []
        const lc: { role: string; content: string }[] = []
        const adj: { role: string; content: string }[] = []
        for (const m of msgs) {
          const entry = { role: m.role, content: m.content }
          if (m.agent === 'loss_cause') lc.push(entry)
          else if (m.agent === 'adjudicator') adj.push(entry)
        }
        if (lc.length > 0) setLcChatMessages(lc)
        if (adj.length > 0) setAdjChatMessages(adj)
      } catch { /* ignore */ }
    }
    loadChats()
  }, [_claimId, isProcessing, authToken])

  const verdictColor = (v: string) => v === 'AUTO APPROVE' || v === 'APPROVE' ? '#16a34a' : v === 'MANUAL REVIEW' || v === 'FLAG' ? '#d97706' : '#dc2626'

  return (
    <div style={{ height: '100%', display: 'flex', gap: '12px', padding: '12px', background: '#f3f4f6' }}>
      <style>{`@keyframes apPulse{0%,100%{opacity:1}50%{opacity:.35}} @keyframes apSpin{to{transform:rotate(360deg)}} @keyframes apBounce{to{transform:translateY(-3px)}} @keyframes apBlink{0%,100%{opacity:1}50%{opacity:0}} @keyframes apGlow{0%,100%{box-shadow:0 0 4px 1px #f9731630}50%{box-shadow:0 0 10px 3px #f9731660}}`}</style>

      {/* Taxonomy Modal */}
      {showTaxonomy && <TaxonomyModal onClose={() => setShowTaxonomy(false)} />}

      {/* Web Search Results Modal */}
      {showWsResults && (() => {
        const wsData = webSearchEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        return wsData ? <WebSearchResultsModal data={wsData} onClose={() => setShowWsResults(false)} /> : null
      })()}

      {/* Fraud Ring Network Modal */}
      {showFraudNetwork && (() => {
        const frData = fraudRingEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        if (!frData) return null
        const graphData = (frData.graph_data as GraphData | undefined) || { nodes: [], edges: [] }
        const riskScore = (frData.fraud_ring_risk_score as number) || 0
        const fFindings = (frData.findings as string[]) || []
        const fSummary = (frData.summary as string) || ''
        return <FraudNetworkModal data={graphData} riskScore={riskScore} findings={fFindings} summary={fSummary} onClose={() => setShowFraudNetwork(false)} />
      })()}

      {/* Loss Cause Details Modal */}
      {showLossCauseDetails && (() => {
        // Try result data first, fall back to early input data event
        const lcData = lossCauseEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        const earlyData = lossCauseEv.find(e => e.data && (e.data as Record<string, unknown>)._input_data_early)?.data as Record<string, unknown> | undefined
        const earlyInput = earlyData?._input_data_early as Record<string, string> | undefined
        const modalData = lcData || (earlyInput ? { _input_data: earlyInput } : null) as Record<string, unknown> | null
        return modalData ? <LossCauseDetailsModal data={modalData} onClose={() => setShowLossCauseDetails(false)} onPreviewImage={setPreviewImg} /> : null
      })()}

      {/* Structured / ML Model Details Modal */}
      {showStructuredDetails && (() => {
        const sData = structuredEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        return sData ? <StructuredDetailsModal data={sData} onClose={() => setShowStructuredDetails(false)} /> : null
      })()}

      {/* Document Agent Details Modal */}
      {showDocumentDetails && (() => {
        const dData = documentEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        return dData ? <DocumentDetailsModal data={dData} onClose={() => setShowDocumentDetails(false)} onPreviewImage={setPreviewImg} /> : null
      })()}

      {/* Visual Agent Details Modal */}
      {showVisualDetails && (() => {
        const vData = visualEv.find(e => e.type === 'result')?.data as Record<string, unknown> | undefined
        return vData ? <VisualDetailsModal data={vData} onClose={() => setShowVisualDetails(false)} onPreviewImage={setPreviewImg} /> : null
      })()}

      {/* Adjudicator Expanded Chat Modal */}
      {showAdjExpandedChat && (
        <>
          <div onClick={() => setShowAdjExpandedChat(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 350, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(900px, 94vw)', height: 'min(700px, 88vh)', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', zIndex: 351, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: isDone('adjudicator') ? 'linear-gradient(135deg,#14532d 0%,#166534 100%)' : 'linear-gradient(135deg,#111827 0%,#1f2937 100%)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GavelSvg /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Final Decision — Chat</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                  {isDone('adjudicator') ? 'Analysis complete — ask follow-up questions' : 'Processing...'}
                </div>
              </div>
              {verdict && (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', background: verdictColor(verdict.fraud_verdict), padding: '4px 12px', borderRadius: '10px' }}>
                  {verdict.fraud_verdict}
                </span>
              )}
              <button onClick={() => setShowAdjExpandedChat(false)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <UnifiedChatStream
              events={adjEvAug}
              chatMessages={adjChatMessages}
              placeholder="Awaiting agent results..."
              streamingContent={adjStreamingContent}
              isStreaming={isAdjChatLoading}
              agentName="Adjudicator"
            />
            <ChatBox
              onSend={handleSendAdj}
              onCancel={handleCancelAdj}
              isLoading={isAdjChatLoading}
              isDisabled={!isDone('adjudicator') && adjEv.length === 0}
              disabledReason={isProcessing ? "Adjudicator is synthesizing..." : "Submit a claim first"}
            />
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {previewImg && (
        <>
          <div onClick={() => setPreviewImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <img src={previewImg} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
            <button onClick={() => setPreviewImg(null)} style={{ padding: '6px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Close</button>
          </div>
        </>
      )}

      {/* ─── SECTION 1 : Loss Cause Agent (25%) ─── */}
      <div style={{ ...cardBase, width: '25%', display: 'flex', flexDirection: 'column' }}>
        <Header
          icon={<BrainSvg />}
          title="Loss Cause Agent"
          sub={isActive('loss_cause') ? 'Classifying...' : isDone('loss_cause') ? 'Complete' : 'Ready'}
          active={isActive('loss_cause')}
          actions={
            <div style={{ display: 'flex', gap: '4px' }}>
              {lossCauseEv.length > 0 && (
                <button
                  onClick={() => setShowLossCauseDetails(true)}
                  title="View input data passed to agent"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 9px', borderRadius: '6px', cursor: 'pointer',
                    background: 'transparent', border: `1px solid #e5e7eb`,
                    color: '#6b7280', fontSize: '11px', fontWeight: 600,
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#7c3aed12'; e.currentTarget.style.borderColor = '#7c3aed60'; e.currentTarget.style.color = '#7c3aed' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  Details
                </button>
              )}
              <button
                onClick={() => setShowTaxonomy(true)}
                title="View Loss Cause Taxonomy"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 9px', borderRadius: '6px', cursor: 'pointer',
                  background: 'transparent', border: `1px solid #e5e7eb`,
                  color: '#6b7280', fontSize: '11px', fontWeight: 600,
                  transition: 'all 0.15s', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = ORANGE + '12'; e.currentTarget.style.borderColor = ORANGE + '60'; e.currentTarget.style.color = ORANGE }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' }}
              >
                <TaxSvg />
                Taxonomy
              </button>
            </div>
          }
        />

        {/* Taxonomy levels display when result arrives */}
        {isDone('loss_cause') && (() => {
          const resultEv = lossCauseEv.find(e => e.type === 'result')
          const d = resultEv?.data as Record<string, unknown> | undefined
          const primary = d?.primary_cause as string | undefined
          const secondary = d?.secondary_cause as string | undefined
          const tertiary = d?.tertiary_cause as string | undefined
          const conf = d?.primary_confidence as number | undefined
          const conf2 = d?.secondary_confidence as number | undefined
          const conf3 = d?.tertiary_confidence as number | undefined
          if (!primary) return null
          return (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f0fdf4', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LOSS CAUSE CLASSIFICATION</div>
              {[
                { level: 'PLC', cause: primary, conf },
                { level: 'SLC', cause: secondary, conf: conf2 },
                { level: 'TLC', cause: tertiary,  conf: conf3 },
              ].filter(r => r.cause).map(({ level, cause, conf: c }) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', background: '#e5e7eb', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>{level}</span>
                  <span style={{ fontSize: '11px', fontWeight: level === 'PLC' ? 600 : 400, color: level === 'PLC' ? '#111827' : '#6b7280', flex: 1 }}>{cause}</span>
                  {c != null && <span style={{ fontSize: '9px', fontWeight: 600, color: '#ca8a04', background: '#fef3c7', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>{c}%</span>}
                </div>
              ))}
            </div>

          )
        })()}

        <UnifiedChatStream
          events={lossCauseEvAug}
          chatMessages={lcChatMessages}
          placeholder="Awaiting claim submission..."
          streamingContent={streamingContent}
          isStreaming={isLcChatLoading}
        />
        <ChatBox
          onSend={handleSendLC}
          onCancel={handleCancelLC}
          isLoading={isLcChatLoading}
          isDisabled={!isDone('loss_cause') && lossCauseEv.length > 0}
          disabledReason={isProcessing ? "Agent is classifying..." : "Submit a claim first"}
        />
      </div>

      {/* ─── SECTION 2 : Adjudicator (fills remaining width) ─── */}
      <div style={{ ...cardBase, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header icon={<GavelSvg />} title="Adjudicator" sub={isProcessing ? 'Coordinating agents...' : isDone('adjudicator') ? 'Complete' : 'Ready'} active={isProcessing && !isDone('adjudicator')} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', gap: '0', overflow: 'hidden' }}>
          {/* 5 Sub-agent cards */}
          {(() => {
            return (
              <div style={{ display: 'flex', gap: '8px', flex: 5, minHeight: 0 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>ML Model</span>
                    {isDone('structured') && (
                      <button onClick={() => setShowStructuredDetails(true)} title="View ML model details" style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        Details
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><SubAgentCard name="Structured" icon={<DataSvg />} events={structuredEv} done={isDone('structured')} active={isActive('structured')} orchestratorRisk={agentRiskLevels['ml_model']} /></div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>Document Agent</span>
                    {isDone('document') && (
                      <button onClick={() => setShowDocumentDetails(true)} title="View document analysis details" style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        Details
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><SubAgentCard name="Document" icon={<DocSvg />} events={documentEv} done={isDone('document')} active={isActive('document')} orchestratorRisk={agentRiskLevels['document']} /></div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>Visual Agent</span>
                    {isDone('visual') && (
                      <button onClick={() => setShowVisualDetails(true)} title="View visual analysis details" style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        Details
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><SubAgentCard name="Visual" icon={<ImgSvg />} events={visualEv} done={isDone('visual')} active={isActive('visual')} orchestratorRisk={agentRiskLevels['visual']} /></div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>Web Search</span>
                    {isDone('web_search') && (
                      <button onClick={() => setShowWsResults(true)} title="View search results" style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        Details
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><SubAgentCard name="Web Search" icon={<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>} events={webSearchEv} done={isDone('web_search')} active={isActive('web_search')} orchestratorRisk={agentRiskLevels['web_search']} /></div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '4px', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>Fraud Ring</span>
                    {isDone('fraud_ring') && (
                      <button onClick={() => setShowFraudNetwork(true)} title="View network graph" style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; e.currentTarget.style.borderColor = '#a5b4fc' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#c7d2fe' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        Details
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}><SubAgentCard name="Fraud Ring" icon={<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='12' cy='12' r='2'/><path d='M12 2a10 10 0 0 1 0 20'/><path d='M12 22a10 10 0 0 1 0-20'/><path d='M2 12h20'/></svg>} events={fraudRingEv} done={isDone('fraud_ring')} active={isActive('fraud_ring')} orchestratorRisk={agentRiskLevels['fraud_ring']} /></div>
                </div>
              </div>
            )
          })()}

          {/* Animated flow connector */}
          <div style={{ flexShrink: 0, padding: '2px 0' }}>
            <FlowConnector active={anySubActive || isActive('adjudicator')} done={allSubDone} />
          </div>

          {/* Adjudicator chat */}
          {(() => {
            const adjDone = isDone('adjudicator')
            const adjActive = isActive('adjudicator')
            // Determine verdict-based colors (like SubAgentCard risk coloring)
            const isReject = adjDone && (verdict?.fraud_verdict === 'SIU' || verdict?.fraud_verdict === 'REJECT')
            const isFlag = adjDone && (verdict?.fraud_verdict === 'MANUAL REVIEW' || verdict?.fraud_verdict === 'FLAG')
            const adjBorderColor = adjDone ? (isReject ? '#fca5a5' : isFlag ? '#fcd34d' : '#86efac') : adjActive ? `${ORANGE}60` : '#e5e7eb'
            const adjHeaderBg = adjDone ? (isReject ? '#fef2f2' : isFlag ? '#fffbeb' : '#f0fdf4') : '#fafafa'
            const adjIconColor = adjDone ? (isReject ? '#dc2626' : isFlag ? '#d97706' : '#16a34a') : ORANGE
            const adjStatusIcon = adjDone ? (isReject ? <WarnSvg /> : isFlag ? <WarnSvg /> : <CheckSvg />) : null
            const adjStatusColor = adjDone ? (isReject ? '#dc2626' : isFlag ? '#d97706' : '#16a34a') : ORANGE
            return (
          <div style={{ ...cardBase, border: `1px solid ${adjBorderColor}`, display: 'flex', flexDirection: 'column', flex: 5, minHeight: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', background: adjHeaderBg }}>
              <span style={{ color: adjIconColor, display: 'flex' }}><GavelSvg /></span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: isReject ? '#991b1b' : isFlag ? '#78350f' : '#374151' }}>Final Decision</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {adjDone ? <span style={{ color: adjStatusColor, display: 'flex' }}>{adjStatusIcon}</span>
                  : adjActive ? <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ORANGE, display: 'inline-block', animation: 'apPulse 1.5s infinite' }} />
                  : null}
                <button onClick={() => setShowAdjExpandedChat(true)} title="Open in larger view"
                  style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e5e7eb' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
              </div>
            </div>
            <UnifiedChatStream
              events={adjEvAug}
              chatMessages={adjChatMessages}
              placeholder="Awaiting agent results..."
              streamingContent={adjStreamingContent}
              isStreaming={isAdjChatLoading}
              agentName="Adjudicator"
            />
            <ChatBox
              onSend={handleSendAdj}
              onCancel={handleCancelAdj}
              isLoading={isAdjChatLoading}
              isDisabled={!isDone('adjudicator') && adjEv.length === 0}
              disabledReason={isProcessing ? "Adjudicator is synthesizing..." : "Submit a claim first"}
            />
          </div>
            )
          })()}
        </div>
      </div>

    </div>
  )
}
