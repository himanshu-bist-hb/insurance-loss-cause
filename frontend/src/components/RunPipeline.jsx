import { useState, useRef } from 'react'
import { Play, ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react'
import { runAnalysisPoll } from '../services/api'
import toast from 'react-hot-toast'

const AGENTS = [
  { id: 'understanding',        label: 'Understanding Agent',    emoji: '🔍', desc: 'Extracts meaning from claim notes' },
  { id: 'classification',       label: 'Classification Agent',   emoji: '🏷️', desc: 'Maps to 3-tier taxonomy' },
  { id: 'validation',           label: 'Validation Agent',       emoji: '✅', desc: 'Audits classification' },
  { id: 'classification_retry', label: 'Retry Agent',            emoji: '🔄', desc: 'Re-classifies with feedback' },
  { id: 'final_output',         label: 'Final Output Agent',     emoji: '📋', desc: 'Synthesises final record' },
]

function AgentStepper({ completedSteps, activeAgent, runValidation }) {
  const visibleAgents = AGENTS.filter(a => {
    if (a.id === 'validation' && !runValidation) return false
    if (a.id === 'classification_retry') return completedSteps.includes('classification_retry') || activeAgent === 'classification_retry'
    return true
  })

  const getStatus = (id) => {
    if (completedSteps.includes(id)) return 'completed'
    if (activeAgent === id) return 'running'
    return 'idle'
  }

  return (
    <div className="pipeline-stepper">
      {visibleAgents.map((agent, idx) => {
        const status = getStatus(agent.id)
        const isLast = idx === visibleAgents.length - 1
        return (
          <>
            <div key={agent.id} className="pipeline-step">
              <div className={`pipeline-step-icon ${status} ${status === 'running' ? 'agent-running-glow' : ''}`}>
                {status === 'completed'
                  ? <CheckCircle2 size={20} />
                  : status === 'running'
                  ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <span className="text-base">{agent.emoji}</span>
                }
              </div>
              <span className={`pipeline-step-label ${status === 'running' ? 'active' : status === 'completed' ? 'done' : ''}`}>
                {agent.label}
              </span>
            </div>
            {!isLast && (
              <div key={`conn-${agent.id}`} className={`pipeline-connector ${completedSteps.includes(agent.id) ? 'done' : ''}`} />
            )}
          </>
        )
      })}
    </div>
  )
}

function ClaimCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  const fc = item.result?.final_output?.final_classification
  const conf = item.result?.final_output?.confidence_score
  const grade = item.result?.final_output?.classification_grade

  const gradeColor = grade === 'HIGH' ? 'badge-success' : grade === 'MEDIUM' ? 'badge-warning' : 'badge-error'

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${
      item.status === 'running' ? 'border-blue-200 bg-blue-50/40' :
      item.status === 'success' ? 'border-slate-200 bg-white' :
      item.status === 'error'   ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
        onClick={() => item.status !== 'running' && setExpanded(e => !e)}
      >
        {/* Status dot */}
        {item.status === 'running' ? (
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
        ) : item.status === 'success' ? (
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        )}

        <span className="font-mono text-xs font-semibold text-slate-700 shrink-0">{item.claim_id}</span>

        {/* Running agents */}
        {item.status === 'running' && item.activeAgent && (
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-blue-600 font-medium">
              {AGENTS.find(a => a.id === item.activeAgent)?.label || item.activeAgent}…
            </span>
          </div>
        )}

        {/* Classification result */}
        {fc && item.status === 'success' && (
          <div className="flex items-center gap-1.5 text-xs ml-1 min-w-0">
            <span className="badge badge-primary shrink-0">{fc.primary_cause}</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-500 truncate hidden sm:block">{fc.secondary_cause}</span>
            <span className="text-slate-300 hidden sm:block">›</span>
            <span className="text-slate-400 truncate hidden md:block">{fc.tertiary_cause}</span>
          </div>
        )}

        {item.status === 'error' && (
          <span className="text-xs text-red-500 ml-1 truncate">Error</span>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {conf !== undefined && (
            <span className={`text-xs font-bold ${conf >= 0.8 ? 'text-emerald-600' : conf >= 0.6 ? 'text-amber-500' : 'text-red-500'}`}>
              {Math.round(conf * 100)}%
            </span>
          )}
          {grade && <span className={`badge ${gradeColor}`}>{grade}</span>}
          {item.completedSteps?.length > 0 && (
            <span className="text-xs text-slate-400">{item.completedSteps.length} steps</span>
          )}
          {item.status !== 'running' && (
            expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />
          )}
        </div>
      </div>

      {expanded && item.status !== 'running' && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50 animate-fade-up">
          {item.result?.final_output?.reason && (
            <div className="mb-3">
              <p className="label-xs mb-1.5">Reasoning</p>
              <p className="text-xs text-slate-600 leading-relaxed">{item.result.final_output.reason}</p>
            </div>
          )}
          {fc && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Primary', value: fc.primary_cause, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                { label: 'Secondary', value: fc.secondary_cause, color: 'bg-purple-50 text-purple-700 border-purple-200' },
                { label: 'Tertiary', value: fc.tertiary_cause, color: 'bg-slate-50 text-slate-700 border-slate-200' },
              ].map(f => (
                <div key={f.label} className={`rounded-lg p-2.5 border text-center ${f.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{f.label}</p>
                  <p className="text-xs font-semibold leading-tight">{f.value}</p>
                </div>
              ))}
            </div>
          )}
          {item.status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {item.result?.error || 'Unknown error'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunPipeline({ sessionId, taxonomy, totalClaims, onResultsUpdate, onComplete }) {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [claimStates, setClaimStates] = useState({})
  const [runValidation, setRunValidation] = useState(false)
  const [globalSteps, setGlobalSteps] = useState([])
  const [globalActive, setGlobalActive] = useState(null)
  const processed = useRef(0)

  const successCount = Object.values(claimStates).filter(c => c.status === 'success').length
  const errorCount   = Object.values(claimStates).filter(c => c.status === 'error').length
  const totalDone    = successCount + errorCount
  const pct          = totalClaims > 0 ? Math.round((totalDone / totalClaims) * 100) : 0

  const handleRun = () => {
    if (!sessionId || !taxonomy) { toast.error('Upload claims and configure taxonomy first'); return }
    setRunning(true); setDone(false); setClaimStates({}); processed.current = 0
    setGlobalSteps([]); setGlobalActive(null)

    runAnalysisPoll(
      { session_id: sessionId, taxonomy, lob: 'excess_and_surplus', run_validation: runValidation, validate_claim_ids: null },
      (event) => {
        if (event.type === 'claim_start') {
          setClaimStates(p => ({ ...p, [event.claim_id]: { claim_id: event.claim_id, status: 'running', activeAgent: null, completedSteps: [], result: null } }))
          setGlobalActive(null); setGlobalSteps([])
          onResultsUpdate?.(event)
        } else if (event.type === 'agent_start') {
          setGlobalActive(event.agent)
          setClaimStates(p => ({ ...p, [event.claim_id]: { ...p[event.claim_id], activeAgent: event.agent } }))
          onResultsUpdate?.(event)
        } else if (event.type === 'agent_complete') {
          setGlobalSteps(p => p.includes(event.agent) ? p : [...p, event.agent])
          setClaimStates(p => ({
            ...p,
            [event.claim_id]: {
              ...p[event.claim_id],
              activeAgent: null,
              completedSteps: [...(p[event.claim_id]?.completedSteps || []), event.agent],
            }
          }))
          onResultsUpdate?.(event)
        } else if (event.type === 'claim_complete') {
          processed.current += 1
          setClaimStates(p => ({ ...p, [event.claim_id]: { ...p[event.claim_id], status: event.status || 'success', activeAgent: null, completedSteps: event.completed_steps || [], result: event } }))
          onResultsUpdate?.(event)
        } else if (event.type === 'pipeline_complete') {
          setRunning(false); setDone(true); setGlobalActive(null)
          toast.success(`Pipeline complete — ${event.total} claims processed`)
          onResultsUpdate?.(event)
          onComplete?.()
        } else if (event.type === 'agent_error') {
          setClaimStates(p => ({ ...p, [event.claim_id]: { ...p[event.claim_id], status: 'error', result: { error: event.error } } }))
          onResultsUpdate?.(event)
        }
      },
      () => { setRunning(false); setDone(true); onComplete?.() },
      (err) => { setRunning(false); toast.error('Pipeline error: ' + err.message) }
    )
  }

  const claimList = Object.values(claimStates)

  return (
    <div className="card p-6 s4">
      <div className="flex items-center gap-3 mb-5">
        <div className="step-num">4</div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Run Analysis Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-agent classification · {totalClaims} claim{totalClaims !== 1 ? 's' : ''}
          </p>
        </div>
        {done && (
          <div className="flex items-center gap-2">
            <span className="badge badge-success">{successCount} succeeded</span>
            {errorCount > 0 && <span className="badge badge-error">{errorCount} failed</span>}
          </div>
        )}
      </div>

      {/* Validation toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <ShieldCheck size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Validation Agent</p>
            <p className="text-xs text-slate-400">Cross-checks each classification for accuracy</p>
          </div>
        </div>
        <button
          onClick={() => setRunValidation(v => !v)}
          className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex items-center ${runValidation ? 'bg-indigo-500' : 'bg-slate-300'}`}
          style={{ height: '22px', width: '40px' }}
        >
          <div className={`absolute w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${runValidation ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || !sessionId || !taxonomy}
        className="btn btn-primary w-full justify-center py-3 text-sm mb-5"
      >
        {running ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running Pipeline…</>
        ) : (
          <><Zap size={16} /> Run Analysis</>
        )}
      </button>

      {/* Agent stepper */}
      {(running || done) && claimList.length > 0 && (
        <div className="mb-5">
          <p className="label-sm mb-3">Agent Execution Pipeline</p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <AgentStepper
              completedSteps={globalSteps}
              activeAgent={globalActive}
              runValidation={runValidation}
            />
          </div>
        </div>
      )}

      {/* Progress */}
      {claimList.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{totalDone} of {totalClaims} claims processed</span>
            <span className="text-xs font-bold text-slate-600">{pct}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${done ? 'success' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Claim cards */}
      {claimList.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {claimList.map(item => <ClaimCard key={item.claim_id} item={item} />)}
        </div>
      )}
    </div>
  )
}
