/**
 * Results View — EXL Claim Analysis Report
 * Matches the exl-results-page.html design with dynamic data
 */
import { useState, type ReactNode } from 'react'

interface AgentResult { agent: string; status: 'completed' | 'error'; findings: Record<string, unknown> }
interface Verdict { fraud_probability: number; fraud_verdict: 'AUTO APPROVE' | 'MANUAL REVIEW' | 'SIU' | 'APPROVE' | 'FLAG' | 'REJECT'; loss_cause_primary: string; loss_cause_secondary?: string; loss_cause_tertiary?: string; loss_cause_confidence?: number; completeness_score?: number; reasoning: string; executive_summary?: string; human_review_required: boolean; processing_time_seconds?: number; agent_risk_levels?: Record<string, string>; high_risk_agents?: string[]; moderate_risk_agents?: string[] }
interface StreamEvent { timestamp: string; agent: string; type: string; content: string; data?: Record<string, unknown> }
interface ResultsViewProps { claimId: string; claimData: Record<string, unknown>; verdict: Verdict; agentResults: AgentResult[]; streamEvents: StreamEvent[]; onBack: () => void; onNewClaim: () => void }

/* ── SVG Icons ── */
type IconProps = { size?: number; color?: string }

const IconWarning = ({ size = 18, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconBolt = ({ size = 18, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const IconCheck = ({ size = 18, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconCheckCircle = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const IconCpu = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  </svg>
)

const IconFileText = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const IconImage = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
)

const IconSearch = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const IconUsers = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)

const IconShieldAlert = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const IconTarget = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
)

const IconPieChart = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21.21 15.89A10 10 0 118 2.83" /><path d="M22 12A10 10 0 0012 2v10z" />
  </svg>
)

const IconBarChart = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const IconClipboard = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
)

const IconPhone = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
)

const IconScale = ({ size = 22, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="1 15 4 6 7 15" /><polyline points="17 15 20 6 23 15" />
    <line x1="1" y1="15" x2="7" y2="15" /><line x1="17" y1="15" x2="23" y2="15" />
    <line x1="8" y1="21" x2="16" y2="21" />
  </svg>
)

const IconSparkles = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" style={{ flexShrink: 0 }}>
    <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" />
    <path d="M20 14l1.04 3.13L24.18 18l-3.14.87L20 22l-1.04-3.13L15.82 18l3.14-.87L20 14z" opacity="0.6" />
  </svg>
)

/* ── Simple Markdown Renderer ── */
function RenderedMarkdown({ text }: { text: string }) {
  const sections = text.split(/\n\n+/)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sections.map((section, i) => {
        const trimmed = section.trim()
        if (!trimmed) return null

        // Section heading: **Title**
        const headingMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
        if (headingMatch) {
          return (
            <h4 key={i} style={{
              fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: '8px 0 0',
              paddingBottom: '6px', borderBottom: '2px solid #f3f4f6',
            }}>
              {headingMatch[1]}
            </h4>
          )
        }

        // Numbered list items
        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter(l => l.trim())
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, j) => {
                const cleaned = item.replace(/^\d+\.\s*/, '')
                return (
                  <div key={j} style={{
                    display: 'flex', gap: '10px', padding: '10px 14px',
                    background: '#f9fafb', borderRadius: '8px', borderLeft: '3px solid #d1d5db',
                  }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: '#6b7280', flexShrink: 0,
                    }}>{j + 1}</span>
                    <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: cleaned.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1f2937">$1</strong>') }} />
                  </div>
                )
              })}
            </div>
          )
        }

        // Regular paragraph with inline bold
        return (
          <p key={i} style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1f2937">$1</strong>') }} />
        )
      })}
    </div>
  )
}

const EXL_ORANGE = '#FF6B35'
const EXL_DARK_ORANGE = '#E85A2A'
const signal = (v: number): 'red' | 'yellow' | 'green' | 'gray' => isNaN(v) ? 'gray' : v >= 0.66 ? 'red' : v >= 0.33 ? 'yellow' : 'green'

function getRiskInfo(score: number): { label: string; color: string; bg: string; barColor: string; icon: ReactNode } {
  if (score < 0) return { label: 'N/A', color: '#9ca3af', bg: '#f3f4f6', barColor: '#d1d5db', icon: <span style={{ fontWeight: 700, fontSize: '14px' }}>—</span> }
  if (score >= 66) return { label: 'High Risk', color: '#dc2626', bg: '#fee2e2', barColor: '#ef4444', icon: <IconWarning size={14} color="#dc2626" /> }
  if (score >= 33) return { label: 'Moderate', color: EXL_ORANGE, bg: '#FFF4E6', barColor: EXL_ORANGE, icon: <IconBolt size={14} color={EXL_ORANGE} /> }
  return { label: 'Low Risk', color: '#16a34a', bg: '#dcfce7', barColor: '#22c55e', icon: <IconCheck size={14} color="#16a34a" /> }
}

/* ── SVG Donut Chart ── */
function DonutChart({ segments, size = 160 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const r = 50
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        {segments.map((seg, i) => {
          const pct = seg.value / total
          const dash = circumference * pct
          const currentOffset = offset
          offset += dash
          return (
            <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={seg.color} strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
              transform="rotate(-90 60 60)" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4b5563' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, display: 'inline-block' }} />
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResultsView({ claimId, claimData, verdict, agentResults, streamEvents, onBack, onNewClaim }: ResultsViewProps) {
  const getFindings = (agent: string) => agentResults.find(r => r.agent === agent)?.findings || {}
  const structured = getFindings('structured') as Record<string, unknown>
  const doc = getFindings('document') as Record<string, unknown>
  const visual = getFindings('visual') as Record<string, unknown>
  const webSearch = getFindings('web_search') as Record<string, unknown>
  const fraudRing = getFindings('fraud_ring') as Record<string, unknown>

  const mlProb = Number(structured.ml_fraud_probability || 0)
  const docRisk = Number(doc.risk_score || 0) / 100
  const visualNoImage = visual.status === 'no_image'
  const visualAiCls = String(visual.ai_classification || '')
  const visualAiProb = Number(visual.ai_probability || 0)
  const visualClsWeight: Record<string, number> = { 'AI Generated': 1.0, 'AI Edited': 0.75, 'Digitally Edited': 0.5 }
  const visualAiRisk = visualAiProb * (visualClsWeight[visualAiCls] || 0)
  const visualOnlineRisk = visual.available_on_internet ? 0.1 : 0
  const visualRisk = Math.max(visualAiRisk, visualOnlineRisk)
  const webRisk = Number(webSearch.web_risk_signal || 0)
  const ringRisk = Number(fraudRing.fraud_ring_risk_score || 0)


  const mlReasoning = String(structured.reasoning || '')
  const docFindings = (doc.findings || []) as Array<{ description: string; severity: string }>
  const docRecommendation = String(doc.recommendation || '')
  const wsContras = (webSearch.contradictions || []) as string[]
  const wsCorrobos = (webSearch.corroborations || []) as string[]
  const frFindings = (fraudRing.findings || []) as string[]

  const g = (...keys: string[]) => {
    for (const k of keys) { const v = claimData[k]; if (v && String(v).toLowerCase() !== 'nan' && String(v).toLowerCase() !== 'none') return String(v) }
    return '—'
  }

  // Orchestrator's authoritative risk levels (factors in date comparison, combined signals)
  const orchRisks = verdict.agent_risk_levels || {}
  const orchSignal = (agent: string, fallback: number): 'red' | 'yellow' | 'green' | 'gray' => {
    const lvl = orchRisks[agent]
    if (lvl === 'HIGH') return 'red'
    if (lvl === 'MODERATE') return 'yellow'
    if (lvl === 'LOW') return 'green'
    return signal(fallback)
  }
  const orchLabel = (agent: string, fallback: number): string => {
    const lvl = orchRisks[agent]
    if (lvl) return lvl
    return fallback >= 0.66 ? 'HIGH' : fallback >= 0.33 ? 'MODERATE' : 'LOW'
  }
  const orchScore = (agent: string, fallback: number): number => {
    const lvl = orchRisks[agent]
    if (lvl === 'HIGH' && fallback < 66) return Math.max(Math.round(fallback), 80)
    if (lvl === 'MODERATE' && fallback < 33) return Math.max(Math.round(fallback), 45)
    return Math.round(fallback)
  }

  // Agent signals
  const agentSignals = [
    { name: 'ML Model', sig: orchSignal('ml_model', mlProb) },
    { name: 'Document', sig: orchSignal('document', docRisk) },
    { name: 'Visual', sig: visualNoImage ? 'gray' as const : orchSignal('visual', visualRisk) },
    { name: 'Web Search', sig: orchSignal('web_search', webRisk) },
    { name: 'Fraud Ring', sig: orchSignal('fraud_ring', ringRisk) },
  ]

  // Risk level label — unified: <33% LOW, 33-66% MODERATE, ≥66% HIGH
  const riskLabel = (v: number) => v >= 0.66 ? 'HIGH' : v >= 0.33 ? 'MODERATE' : 'LOW'

  // Agent scores for the grid
  const agents = [
    { name: 'ML Model', icon: <IconCpu size={28} color="#6366f1" />, score: Math.round(mlProb * 100), risk: orchLabel('ml_model', mlProb), summary: mlReasoning ? mlReasoning.slice(0, 80) : 'Claim patterns analyzed' },
    { name: 'Document', icon: <IconFileText size={28} color="#2563eb" />, score: Math.round(docRisk * 100), risk: orchLabel('document', docRisk), summary: String(doc.summary || '').trim() ? String(doc.summary).slice(0, 120) : docRecommendation && docRecommendation !== '—' ? docRecommendation.slice(0, 80) : 'Document review complete' },
    { name: 'Visual', icon: <IconImage size={28} color="#7c3aed" />, score: visualNoImage ? -1 : orchScore('visual', visualRisk * 100), risk: visualNoImage ? 'N/A' : orchLabel('visual', visualRisk), summary: visualNoImage ? 'No images submitted' : visualAiCls === 'AI Generated' ? 'AI-generated images detected' : visualAiCls === 'AI Edited' ? 'AI-edited images detected' : visualAiCls === 'Digitally Edited' ? 'Digitally edited images detected' : visual.available_on_internet ? 'Images found online' : 'Images appear authentic' },
    { name: 'Web Search', icon: <IconSearch size={28} color="#0891b2" />, score: Math.round(webRisk * 100), risk: orchLabel('web_search', webRisk), summary: wsContras.length > 0 ? 'Contradictions found' : 'No contradictions found' },
    { name: 'Fraud Ring', icon: <IconUsers size={28} color="#dc2626" />, score: Math.round(ringRisk * 100), risk: orchLabel('fraud_ring', ringRisk), summary: frFindings.some(f => !f.includes('No significant')) ? 'Network links detected' : 'No network detected' },
  ]

  // Categorize findings
  const highFindings: { title: string; desc: string }[] = []
  const medFindings: { title: string; desc: string }[] = []
  const goodFindings: { title: string; desc: string }[] = []

  docFindings.forEach(f => {
    if (/high|critical/i.test(f.severity)) {
      highFindings.push({ title: f.description.split('.')[0] || 'Document Issue', desc: f.description })
    } else if (/medium/i.test(f.severity)) {
      medFindings.push({ title: f.description.split('.')[0] || 'Document Note', desc: f.description })
    } else {
      goodFindings.push({ title: f.description.split('.')[0] || 'Verified', desc: f.description })
    }
  })

  if (!visualNoImage) {
    const visualOrchRisk = orchRisks['visual']
    const earliestDate = String(visual.earliest_online_date || '')

    // Images found online with earliest date → HIGH (predates claim = stock/stolen imagery)
    if (visual.available_on_internet && earliestDate) {
      highFindings.push({ title: 'Images Predate Claim', desc: `Submitted images were found online with earliest appearance on ${earliestDate} — before the claim was filed. This strongly suggests use of stock or stolen imagery.` })
    } else if (visual.available_on_internet) {
      medFindings.push({ title: 'Images Found Online', desc: 'Submitted images were found on the internet, suggesting they may not be original' })
    }

    // AI classification — promote to HIGH if orchestrator says visual is HIGH
    if (visualAiCls === 'AI Generated') {
      highFindings.push({ title: 'AI-Generated Images', desc: 'High confidence detection of synthetic/AI-generated images' })
    } else if (visualAiCls === 'AI Edited') {
      const aiDesc = `Images appear to have been edited with AI tools (${Math.round(visualAiProb * 100)}% probability)`
      if (visualOrchRisk === 'HIGH') {
        highFindings.push({ title: 'AI-Edited Images', desc: aiDesc })
      } else {
        medFindings.push({ title: 'AI-Edited Images', desc: aiDesc })
      }
    } else if (visualAiCls === 'Digitally Edited') {
      medFindings.push({ title: 'Digitally Edited Images', desc: `Images show signs of digital editing (${Math.round(visualAiProb * 100)}% probability)` })
    } else if (!visual.available_on_internet) {
      goodFindings.push({ title: 'Authentic Images', desc: 'Submitted images appear to be genuine photographs' })
    }
  }

  if (webSearch.weather_skipped) {
    medFindings.push({ title: 'Weather Verification Skipped', desc: String(webSearch.weather_skip_reason || 'Claim location could not be determined — weather verification was not performed.') })
  }
  wsContras.forEach(c => medFindings.push({ title: 'Web Contradiction', desc: c }))
  wsCorrobos.forEach(c => goodFindings.push({ title: 'Verified Information', desc: c }))

  frFindings.forEach(f => {
    if (f.includes('No significant')) {
      goodFindings.push({ title: 'No Fraud Ring Connection', desc: f })
    } else {
      highFindings.push({ title: 'Fraud Ring Alert', desc: f })
    }
  })

  // Consensus counts
  const highCount = agentSignals.filter(a => a.sig === 'red').length
  const medCount = agentSignals.filter(a => a.sig === 'yellow').length
  const lowCount = agentSignals.filter(a => a.sig === 'green').length
  const activeCount = agentSignals.filter(a => a.sig !== 'gray').length
  const agreementPct = activeCount > 0 ? Math.round((Math.max(highCount, medCount, lowCount) / activeCount) * 100) : 0

  // Processing time — prefer backend-computed value, fall back to stream event timestamps
  let processingTime = '—'
  if (verdict.processing_time_seconds != null && verdict.processing_time_seconds > 0) {
    const diff = verdict.processing_time_seconds
    processingTime = diff >= 60 ? `${(diff / 60).toFixed(1)}m` : `${diff.toFixed(1)}s`
  } else if (streamEvents.length >= 2) {
    try {
      const first = new Date(streamEvents[0].timestamp).getTime()
      const last = new Date(streamEvents[streamEvents.length - 1].timestamp).getTime()
      const diff = (last - first) / 1000
      if (diff > 0) processingTime = diff >= 60 ? `${(diff / 60).toFixed(1)}m` : `${diff.toFixed(1)}s`
    } catch { /* ignore */ }
  }

  // Claim amount
  const claimAmount = g('claim_amount', 'Loss_Amount')
  const claimAmountDisplay = claimAmount !== '—' ? `$${Number(claimAmount).toLocaleString()}` : '—'

  // Confidence as label
  const rawConf = verdict.completeness_score || verdict.loss_cause_confidence || null
  const confNum = rawConf ? Math.round(rawConf * (rawConf < 1 ? 100 : 1)) : 0
  const confidenceDisplay = !rawConf ? '—' : confNum >= 66 ? 'High' : confNum >= 33 ? 'Medium' : 'Low'

  // Hero action — derived from verdict (SIU / MANUAL REVIEW / AUTO APPROVE)
  const fv = verdict.fraud_verdict
  const actionIcon = fv === 'SIU' || fv === 'REJECT'
    ? <IconShieldAlert size={44} color="#fff" />
    : fv === 'MANUAL REVIEW' || fv === 'FLAG'
      ? <IconWarning size={44} color="#fff" />
      : <IconCheckCircle size={44} color="#fff" />
  const actionText = fv === 'SIU' ? 'Refer to Special Investigation Unit'
    : fv === 'REJECT' ? 'Refer to Special Investigation Unit'
    : fv === 'MANUAL REVIEW' || fv === 'FLAG' ? 'Manual Review Required'
    : 'Auto Approved for Processing'

  // Hero colors based on risk level
  const riskLevel = fv === 'SIU' || fv === 'REJECT' ? 'HIGH' : fv === 'MANUAL REVIEW' || fv === 'FLAG' ? 'MODERATE' : 'LOW'
  const heroGradient = riskLevel === 'HIGH'
    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
    : riskLevel === 'MODERATE'
    ? `linear-gradient(135deg, ${EXL_ORANGE} 0%, ${EXL_DARK_ORANGE} 100%)`
    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
  const heroShadow = riskLevel === 'HIGH'
    ? '0 20px 40px rgba(220,38,38,0.25)'
    : riskLevel === 'MODERATE'
    ? '0 20px 40px rgba(255,107,53,0.25)'
    : '0 20px 40px rgba(22,163,74,0.25)'

  const [showReasoning, setShowReasoning] = useState(false)

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'ui-sans-serif,system-ui,-apple-system,sans-serif' }}>

      {/* ═══════ SECTION 1: Risk Score Hero ═══════ */}
      <div style={{
        background: heroGradient,
        borderRadius: '16px', padding: '32px', marginBottom: '24px', color: '#fff',
        boxShadow: heroShadow,
      }}>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Risk Level Badge */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: '180px', height: '180px', borderRadius: '50%',
              border: '6px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              background: 'rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '1px' }}>{riskLevel}</div>
              <div style={{ fontSize: '11px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Risk Level</div>
            </div>
          </div>

          {/* Recommendation */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ lineHeight: 1, paddingTop: '4px' }}>{actionIcon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Recommended Action</div>
                <h3 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>{actionText}</h3>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.75 }}>Confidence</div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>{confidenceDisplay}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.75 }}>Processing Time</div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>{processingTime}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 16px' }}>
                    <div style={{ fontSize: '11px', opacity: 0.75 }}>Claim Amount</div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>{claimAmountDisplay}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button style={{
                    padding: '8px 20px', background: '#fff', color: riskLevel === 'HIGH' ? '#dc2626' : riskLevel === 'MODERATE' ? EXL_ORANGE : '#16a34a', fontWeight: 700,
                    borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}>
                    <IconClipboard size={15} color={riskLevel === 'HIGH' ? '#dc2626' : riskLevel === 'MODERATE' ? EXL_ORANGE : '#16a34a'} /> Request More Info
                  </button>
                  {(fv === 'SIU' || fv === 'REJECT') && (
                    <button style={{
                      padding: '8px 20px', background: '#dc2626', color: '#fff', fontWeight: 700,
                      borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}>
                      <IconShieldAlert size={15} color="#fff" /> Send to SIU
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 2: Agent Analysis Grid ═══════ */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {agents.map(a => {
          const info = getRiskInfo(a.score)
          return (
            <div key={a.name} style={{
              flex: '1 1 180px', minWidth: '170px', background: '#fff', borderRadius: '12px',
              padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: '#f3f4f6', borderRadius: '10px' }}>{a.icon}</div>
                <span style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                  background: info.bg, color: info.color,
                }}>{a.risk}</span>
              </div>
              <h3 style={{ fontWeight: 700, color: '#1f2937', marginBottom: '10px', fontSize: '14px' }}>{a.name}</h3>
              <div style={{ marginBottom: '10px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                  background: info.bg, color: info.color,
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}>
                  {info.icon} {info.label}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, lineHeight: 1.4 }}>{a.summary}</p>
            </div>
          )
        })}
      </div>

      {/* ═══════ SECTION 3: Two Column Layout ═══════ */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>

        {/* Left Column: Key Findings */}
        <div style={{ flex: '2 1 500px', minWidth: '300px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <IconTarget size={28} color={EXL_ORANGE} />
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Key Findings</h3>
            </div>

            {/* High Priority */}
            {highFindings.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }} />
                  <h4 style={{ fontWeight: 700, color: '#b91c1c', margin: 0, fontSize: '14px' }}>High Priority Issues ({highFindings.length})</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {highFindings.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px',
                      background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '8px',
                    }}>
                      <div style={{ paddingTop: '1px' }}><IconWarning size={18} color="#dc2626" /></div>
                      <div>
                        <p style={{ fontWeight: 600, color: '#7f1d1d', margin: '0 0 4px', fontSize: '13px' }}>{f.title}</p>
                        <p style={{ fontSize: '12px', color: '#991b1b', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medium Priority */}
            {medFindings.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', background: EXL_ORANGE, borderRadius: '50%' }} />
                  <h4 style={{ fontWeight: 700, color: EXL_ORANGE, margin: 0, fontSize: '14px' }}>Medium Priority Issues ({medFindings.length})</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {medFindings.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px',
                      background: '#FFF4E6', borderLeft: `4px solid ${EXL_ORANGE}`, borderRadius: '8px',
                    }}>
                      <div style={{ paddingTop: '1px' }}><IconBolt size={18} color={EXL_ORANGE} /></div>
                      <div>
                        <p style={{ fontWeight: 600, color: '#1f2937', margin: '0 0 4px', fontSize: '13px' }}>{f.title}</p>
                        <p style={{ fontSize: '12px', color: '#374151', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified Information */}
            {goodFindings.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
                  <h4 style={{ fontWeight: 700, color: '#15803d', margin: 0, fontSize: '14px' }}>Verified Information ({goodFindings.length})</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {goodFindings.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px',
                      background: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: '8px',
                    }}>
                      <div style={{ paddingTop: '1px' }}><IconCheck size={18} color="#16a34a" /></div>
                      <div>
                        <p style={{ fontWeight: 600, color: '#14532d', margin: '0 0 4px', fontSize: '13px' }}>{f.title}</p>
                        <p style={{ fontSize: '12px', color: '#166534', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highFindings.length === 0 && medFindings.length === 0 && goodFindings.length === 0 && (
              <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>No findings available</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ flex: '1 1 280px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Agent Consensus */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <IconPieChart size={22} color={EXL_ORANGE} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Agent Consensus</h3>
            </div>

            <DonutChart segments={[
              { value: highCount, color: '#DC2626', label: 'High Risk' },
              { value: medCount, color: EXL_ORANGE, label: 'Medium' },
              { value: lowCount, color: '#10B981', label: 'Low Risk' },
            ]} />

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Agreement Level:</span>
                <span style={{ fontWeight: 700, color: '#1f2937' }}>{agreementPct}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>High Risk Votes:</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{highCount} of {activeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Low Risk Votes:</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>{lowCount} of {activeCount}</span>
              </div>
            </div>
          </div>

          {/* Loss Cause */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <IconBarChart size={22} color={EXL_ORANGE} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Loss Cause Analysis</h3>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#15803d' }}>{verdict.loss_cause_primary || '—'}</div>
              {verdict.loss_cause_secondary && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', paddingLeft: '4px' }}>↳ {verdict.loss_cause_secondary}</div>}
              {verdict.loss_cause_tertiary && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', paddingLeft: '16px' }}>↳ {verdict.loss_cause_tertiary}</div>}
            </div>
            {verdict.loss_cause_confidence != null && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#6b7280' }}>Confidence</span>
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>{Math.round((verdict.loss_cause_confidence < 1 ? verdict.loss_cause_confidence * 100 : verdict.loss_cause_confidence))}%</span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${verdict.loss_cause_confidence < 1 ? verdict.loss_cause_confidence * 100 : verdict.loss_cause_confidence}%`,
                    height: '100%', borderRadius: '999px', background: '#22c55e',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '12px', padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '2px solid #bfdbfe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <IconCheckCircle size={22} color="#2563eb" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Recommended Actions</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button style={{
                width: '100%', padding: '12px', background: '#fff', border: '2px solid #e5e7eb',
                borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IconPhone size={20} color="#6b7280" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#1f2937', margin: 0, fontSize: '13px' }}>Contact Claimant</p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Verify incident details</p>
                  </div>
                  <span style={{ color: '#9ca3af' }}>→</span>
                </div>
              </button>

              <button style={{
                width: '100%', padding: '12px', background: '#fff', border: '2px solid #e5e7eb',
                borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IconFileText size={20} color="#6b7280" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#1f2937', margin: 0, fontSize: '13px' }}>Request Documents</p>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>Get missing estimates</p>
                  </div>
                  <span style={{ color: '#9ca3af' }}>→</span>
                </div>
              </button>

              {(fv === 'SIU' || fv === 'REJECT') && (
                <button style={{
                  width: '100%', padding: '12px',
                  background: `linear-gradient(135deg, ${EXL_ORANGE}, ${EXL_DARK_ORANGE})`,
                  border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', color: '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <IconShieldAlert size={20} color="#fff" />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '13px' }}>Escalate to SIU</p>
                      <p style={{ fontSize: '11px', opacity: 0.9, margin: 0 }}>High priority review</p>
                    </div>
                    <span style={{ opacity: 0.75 }}>→</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 4: Adjudicator Reasoning (collapsible) ═══════ */}
      {verdict.reasoning && (
        <div style={{ background: '#fff', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <button onClick={() => setShowReasoning(!showReasoning)} style={{
            width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '14px', fontWeight: 600, color: '#374151', background: '#fafafa', border: 'none',
            cursor: 'pointer', textAlign: 'left', borderBottom: showReasoning ? '1px solid #e5e7eb' : 'none',
          }}>
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" style={{ transform: showReasoning ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M3 1l4 4-4 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <IconScale size={18} color="#6b7280" />
            Adjudicator Reasoning
          </button>
          {showReasoning && (
            <div style={{ padding: '20px 24px' }}>
              <RenderedMarkdown text={verdict.reasoning} />
            </div>
          )}
        </div>
      )}

      {/* ═══════ SECTION 5: Bottom Action Bar ═══════ */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '20px 24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <IconClipboard size={28} color={EXL_ORANGE} />
          <div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Claim ID: {claimId}</p>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
              Analysis completed{processingTime !== '—' ? ` in ${processingTime}` : ''} | {verdict.loss_cause_primary || 'Pending'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{
            padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px',
            fontWeight: 600, color: '#374151', cursor: 'pointer', fontSize: '13px',
          }}>
            ← Back to Processing
          </button>
          <button onClick={onNewClaim} style={{
            padding: '10px 20px',
            background: `linear-gradient(135deg, ${EXL_ORANGE}, ${EXL_DARK_ORANGE})`,
            border: 'none', borderRadius: '8px',
            fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: '13px',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            New Analysis <IconSparkles size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  )
}
