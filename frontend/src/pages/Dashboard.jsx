import { useState } from 'react'
import { Network, Activity, ChevronRight, CheckCircle2 } from 'lucide-react'
import LOBSelector from '../components/LOBSelector'
import DataUpload from '../components/DataUpload'
import TaxonomySelector from '../components/TaxonomySelector'
import RunPipeline from '../components/RunPipeline'
import ResultsTable from '../components/ResultsTable'
import LearningRulesPanel from '../components/LearningRulesPanel'
import AgentFlowGraph from '../components/AgentFlowGraph'

const AGENTS = [
  { key: 'understanding',        label: 'Understanding Agent',    emoji: '🔍', baseColor: '#3B82F6' },
  { key: 'classification',       label: 'Classification Agent',   emoji: '🏷️', baseColor: '#4F46E5' },
  { key: 'validation',           label: 'Validation Agent',       emoji: '✅', baseColor: '#F59E0B' },
  { key: 'classification_retry', label: 'Retry Agent',            emoji: '🔄', baseColor: '#F97316' },
  { key: 'final_output',         label: 'Final Output Agent',     emoji: '📋', baseColor: '#10B981' },
]

export default function Dashboard() {
  const [lob, setLob]               = useState('excess_and_surplus')
  const [uploadData, setUploadData] = useState(null)
  const [taxonomy, setTaxonomy]     = useState(null)
  const [results, setResults]       = useState([])
  const [showFlow, setShowFlow]     = useState(false)
  const [activeAgent, setActiveAgent]         = useState(null)
  const [completedSteps, setCompletedSteps]   = useState([])
  const [currentClaimId, setCurrentClaimId]   = useState(null)
  const [claimsCompleted, setClaimsCompleted] = useState(0)
  const [isRunning, setIsRunning]   = useState(false)

  const handleResultEvent = (event) => {
    if (event.type === 'claim_start') {
      setCurrentClaimId(event.claim_id)
      setCompletedSteps([])
      setActiveAgent(null)
      setIsRunning(true)
    }
    if (event.type === 'agent_start')    { setActiveAgent(event.agent); setIsRunning(true) }
    if (event.type === 'agent_complete') {
      setActiveAgent(null)
      setCompletedSteps(prev => prev.includes(event.agent) ? prev : [...prev, event.agent])
    }
    if (event.type === 'claim_complete') {
      setClaimsCompleted(c => c + 1)
      setCompletedSteps(event.completed_steps || [])
      setActiveAgent(null)
      setResults(prev => {
        const idx = prev.findIndex(r => r.claim_id === event.claim_id)
        const row = {
          claim_id: event.claim_id,
          claim_notes: event.claim_notes || '',
          status: event.status || 'success',
          error: event.error,
          understanding_output: event.understanding_output,
          cause_output: event.cause_output,
          classification_output: event.classification_output,
          corrected_classification_output: event.corrected_classification_output || null,
          validation_output: event.validation_output,
          final_output: event.final_output,
          completed_steps: event.completed_steps || [],
        }
        if (idx >= 0) { const u = [...prev]; u[idx] = row; return u }
        return [...prev, row]
      })
    }
    if (event.type === 'pipeline_complete') {
      setIsRunning(false)
      setActiveAgent(null)
      setCurrentClaimId(null)
    }
  }

  const successCount = results.filter(r => r.status === 'success').length
  const avgConf = successCount
    ? results.filter(r => r.status === 'success').reduce((a, r) => a + (r.final_output?.confidence_score || 0), 0) / successCount
    : 0

  const steps = [
    { label: 'Line of Business', done: true,              active: true },
    { label: 'Upload Claims',    done: !!uploadData?.success, active: !uploadData?.success },
    { label: 'Taxonomy',         done: !!taxonomy,         active: !!uploadData?.success && !taxonomy },
    { label: 'Run Analysis',     done: results.length > 0, active: !!taxonomy },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ background: 'white', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
                <path d="M10 6v4l2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>Loss Cause Agent</span>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, borderLeft: '1px solid #E2E8F0', paddingLeft: 12, marginLeft: 4 }}>Insurance Classification AI</span>
          </div>

          {/* Workflow steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            {steps.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 99,
                  background: s.done ? '#ECFDF5' : s.active ? '#EEF2FF' : 'transparent',
                  border: `1px solid ${s.done ? '#A7F3D0' : s.active ? '#C7D2FE' : 'transparent'}`,
                  transition: 'all 0.2s',
                }}>
                  {s.done
                    ? <CheckCircle2 size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                    : <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${s.active ? '#6366F1' : '#CBD5E1'}`, flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.done ? '#065F46' : s.active ? '#4F46E5' : '#94A3B8', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight size={12} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '5px 12px', borderRadius: 8 }}>
                <div style={{ width: 12, height: 12, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontWeight: 600 }}>Running…</span>
              </div>
            )}
            {!isRunning && results.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
                <span><strong style={{ color: '#0F172A' }}>{successCount}</strong> classified</span>
                {avgConf > 0 && <span style={{ color: '#94A3B8' }}>· avg {Math.round(avgConf * 100)}%</span>}
              </div>
            )}
            <button
              onClick={() => setShowFlow(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.background = '#EEF2FF' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'white' }}
            >
              <Network size={13} /> Agent Flow
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '5px 10px', borderRadius: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
              API Live
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>Claims Classification</h1>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 1.6 }}>
            Upload claims data, configure your taxonomy, and run the multi-agent AI pipeline to classify each loss cause automatically.
          </p>
        </div>

        {/* ── Agent pipeline bar ──────────────────────────────────────────── */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {AGENTS.map((agent, i) => {
            const isActive = activeAgent === agent.key
            const isDone   = completedSteps.includes(agent.key)
            return (
              <div key={agent.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px', borderRadius: 8,
                  background: isDone ? `${agent.baseColor}10` : isActive ? `${agent.baseColor}15` : '#F8FAFC',
                  border: `1.5px solid ${isDone ? `${agent.baseColor}40` : isActive ? agent.baseColor : '#E2E8F0'}`,
                  boxShadow: isActive ? `0 0 0 3px ${agent.baseColor}20` : 'none',
                  transition: 'all 0.25s ease',
                  animation: isActive ? 'pulse 2s ease infinite' : 'none',
                }}>
                  <span style={{ fontSize: 14 }}>
                    {isDone ? '✓' : isActive
                      ? <span style={{ display: 'inline-block', width: 12, height: 12, border: `2px solid ${agent.baseColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite', verticalAlign: 'middle' }} />
                      : agent.emoji}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? agent.baseColor : isActive ? agent.baseColor : '#94A3B8', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                    {agent.label}
                  </span>
                </div>
                {i < AGENTS.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }}>
                    <svg width="20" height="10" viewBox="0 0 20 10">
                      <path d="M1 5h15M12 1l4 4-4 4" stroke={isDone ? agent.baseColor : '#CBD5E1'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
          {/* spacer — "Agent Flow" button is in the header */}
        </div>

        {/* ── Setup steps — clean vertical flow ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <LOBSelector value={lob} onChange={setLob} />
          <DataUpload onUploadComplete={setUploadData} />

          {uploadData?.success && (
            <TaxonomySelector lob={lob} onTaxonomyReady={setTaxonomy} />
          )}

          {uploadData?.success && taxonomy && (
            <RunPipeline
              sessionId={uploadData.session_id}
              taxonomy={taxonomy}
              totalClaims={uploadData.row_count}
              onResultsUpdate={handleResultEvent}
              onComplete={() => { setIsRunning(false); setActiveAgent(null) }}
            />
          )}

          {results.length > 0 && (
            <>
              <ResultsTable
                results={results}
                taxonomy={taxonomy}
                sessionId={uploadData?.session_id}
                onResultUpdate={handleResultEvent}
              />
              <LearningRulesPanel />
            </>
          )}
        </div>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!uploadData && (
          <div style={{ marginTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Activity size={30} color="#6366F1" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>Ready to classify claims</h3>
            <p style={{ fontSize: 13, color: '#94A3B8', maxWidth: 380, lineHeight: 1.7, margin: 0 }}>
              Select your line of business above, upload a claims CSV, configure the taxonomy, and the pipeline will classify every loss cause automatically.
            </p>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #E2E8F0', background: 'white', marginTop: 48, padding: '16px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Loss Cause Agent</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>6-agent pipeline · FastAPI + LangGraph · React</span>
        </div>
      </footer>

      {/* ── Flow modal ─────────────────────────────────────────────────────── */}
      {showFlow && (
        <AgentFlowGraph
          onClose={() => setShowFlow(false)}
          activeAgent={activeAgent}
          completedSteps={completedSteps}
          currentClaimId={currentClaimId}
          claimsCompleted={claimsCompleted}
          totalClaims={uploadData?.row_count || 0}
          isRunning={isRunning}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.7; } }
      `}</style>
    </div>
  )
}
