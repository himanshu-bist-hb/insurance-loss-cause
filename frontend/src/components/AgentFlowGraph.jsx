import { useCallback, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, MarkerType,
  useNodesState, useEdgesState, EdgeLabelRenderer, getBezierPath,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Network } from 'lucide-react'

const AGENT_META = {
  understanding:        { color: '#3B82F6', bg: '#EFF6FF', label: 'Understanding Agent',    emoji: '🔍', desc: 'Extracts meaning from claim notes & PDFs' },
  classification:       { color: '#4F46E5', bg: '#EEF2FF', label: 'Classification Agent',   emoji: '🏷️', desc: 'Maps claim to 3-tier taxonomy' },
  validation:           { color: '#F59E0B', bg: '#FFFBEB', label: 'Validation Agent',       emoji: '✅', desc: 'Audits classification accuracy (optional)' },
  classification_retry: { color: '#F97316', bg: '#FFF7ED', label: 'Retry Agent',            emoji: '🔄', desc: 'Re-classifies using validation feedback' },
  final_output:         { color: '#10B981', bg: '#ECFDF5', label: 'Final Output Agent',     emoji: '📋', desc: 'Synthesises authoritative record' },
}

function AgentNode({ data }) {
  const meta = AGENT_META[data.agentId] || AGENT_META.final_output
  const isActive = data.status === 'running'
  const isDone   = data.status === 'completed'

  return (
    <div style={{
      background: isDone ? meta.bg : isActive ? meta.bg : '#F8FAFC',
      border: `2px solid ${isDone ? meta.color : isActive ? meta.color : '#E2E8F0'}`,
      borderRadius: 14,
      padding: '14px 18px',
      minWidth: 190,
      boxShadow: isActive ? `0 0 0 4px ${meta.color}33, 0 4px 12px rgba(0,0,0,0.1)` : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'all 0.35s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
          animation: 'shimmerLine 1.5s ease-in-out infinite',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: isDone || isActive ? meta.color : '#E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {isDone
            ? <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>✓</span>
            : isActive
            ? <div style={{ width: 15, height: 15, border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            : <span>{meta.emoji}</span>
          }
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: isDone || isActive ? meta.color : '#64748B', lineHeight: 1.2 }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
            {meta.desc}
          </div>
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 600, border: '1px solid',
        background: isDone ? '#ECFDF5' : isActive ? '#EFF6FF' : '#F1F5F9',
        color: isDone ? '#065F46' : isActive ? '#1D4ED8' : '#94A3B8',
        borderColor: isDone ? '#A7F3D0' : isActive ? '#BFDBFE' : '#E2E8F0',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isDone ? '#10B981' : isActive ? '#3B82F6' : '#CBD5E1', display: 'inline-block' }} />
        {isDone ? 'Completed' : isActive ? 'Running…' : 'Waiting'}
      </div>
    </div>
  )
}

// Animated data-flow edge with a label pill
function DataFlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, style, markerEnd, data }) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const color = data?.color || '#CBD5E1'
  const animated = data?.animated !== false

  return (
    <>
      {/* Invisible wider path for easier hover */}
      <path id={id} className="react-flow__edge-path" d={edgePath} strokeWidth={12} fill="none" stroke="transparent" />

      {/* Animated background track */}
      <path
        d={edgePath}
        fill="none"
        stroke={`${color}22`}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Main animated edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={animated ? '8 6' : 'none'}
        style={animated ? { animation: `dashFlow 1.2s linear infinite` } : {}}
        markerEnd={markerEnd}
      />

      {/* Label pill */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{
              background: 'white',
              border: `1.5px solid ${color}55`,
              borderRadius: 99,
              padding: '2px 8px',
              fontSize: 9,
              fontWeight: 600,
              color: color,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              letterSpacing: '0.01em',
            }}>
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { agentNode: AgentNode }
const edgeTypes = { dataFlow: DataFlowEdge }

const BASE_NODES = [
  { id: 'understanding',        position: { x: 300, y: 20  }, type: 'agentNode', data: { agentId: 'understanding',        status: 'idle' } },
  { id: 'classification',       position: { x: 300, y: 165 }, type: 'agentNode', data: { agentId: 'classification',       status: 'idle' } },
  { id: 'validation',           position: { x: 610, y: 165 }, type: 'agentNode', data: { agentId: 'validation',           status: 'idle' } },
  { id: 'classification_retry', position: { x: 610, y: 310 }, type: 'agentNode', data: { agentId: 'classification_retry', status: 'idle' } },
  { id: 'final_output',         position: { x: 300, y: 310 }, type: 'agentNode', data: { agentId: 'final_output',         status: 'idle' } },
]

const mkEdge = (id, source, target, label, color, opts = {}) => ({
  id,
  source,
  target,
  type: 'dataFlow',
  label,
  data: { color, animated: true },
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
  ...opts,
})

const BASE_EDGES = [
  mkEdge('e1', 'understanding',        'classification',       'claim analysis · signals',         '#4F46E5'),
  mkEdge('e2', 'classification',       'final_output',         'classification (no validation)',   '#10B981', { style: { strokeDasharray: '5 4' } }),
  mkEdge('e3', 'classification',       'validation',           'classification · taxonomy',         '#F59E0B'),
  mkEdge('e4', 'validation',           'final_output',         'validated ✓',                     '#10B981'),
  mkEdge('e5', 'validation',           'classification_retry', 'issues · suggested fix',           '#F97316'),
  mkEdge('e6', 'classification_retry', 'final_output',         'revised classification',           '#6366F1'),
]

const AGENT_LABELS = {
  understanding: 'Understanding Agent',
  classification: 'Classification Agent', validation: 'Validation Agent',
  classification_retry: 'Retry Agent', final_output: 'Final Output Agent',
}

export default function AgentFlowGraph({ onClose, activeAgent, completedSteps, currentClaimId, claimsCompleted, totalClaims, isRunning }) {
  const buildNodes = (active, done) =>
    BASE_NODES.map(n => ({
      ...n,
      data: {
        ...n.data,
        status: done?.includes(n.id) ? 'completed' : active === n.id ? 'running' : 'idle',
      },
    }))

  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(activeAgent, completedSteps))
  const [edges] = useEdgesState(BASE_EDGES)

  // Keep node states in sync with live props
  useEffect(() => {
    setNodes(buildNodes(activeAgent, completedSteps))
  }, [activeAgent, completedSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ width: '92vw', maxWidth: 980, height: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Network size={16} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Agent Pipeline Graph</h3>
              <p className="text-xs text-slate-500">Real-time execution flow</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 mr-2">
              {[{ color: '#E2E8F0', label: 'Waiting' }, { color: '#3B82F6', label: 'Running' }, { color: '#10B981', label: 'Done' }].map(l => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </span>
              ))}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X size={16} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Claims progress banner */}
        {(isRunning || claimsCompleted > 0) && (
          <div style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

            {/* Progress bar + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
              <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: isRunning ? '#4F46E5' : '#10B981',
                  width: `${totalClaims ? Math.round((claimsCompleted / totalClaims) * 100) : 0}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                {claimsCompleted} / {totalClaims}
              </span>
              <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>claims done</span>
            </div>

            {/* Current claim */}
            {currentClaimId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', animation: 'pulse 1.5s ease infinite' }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Processing</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>
                  {currentClaimId}
                </span>
              </div>
            )}

            {/* Active agent */}
            {activeAgent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, border: '2px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#475569' }}>Active:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>{AGENT_LABELS[activeAgent] || activeAgent}</span>
              </div>
            )}

            {!isRunning && claimsCompleted === totalClaims && totalClaims > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#059669' }}>
                ✓ Pipeline complete — all {totalClaims} claims classified
              </div>
            )}
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, background: '#F8FAFC', position: 'relative' }}>
          <style>{`
            @keyframes shimmerLine { 0%,100%{opacity:0.3;transform:scaleX(0.2)} 50%{opacity:1;transform:scaleX(1)} }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes dashFlow { from { stroke-dashoffset: 28; } to { stroke-dashoffset: 0; } }
          `}</style>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={true}
            panOnDrag={true}
            minZoom={0.4}
            maxZoom={1.6}
          >
            <Background color="#E2E8F0" gap={28} size={1} />
            <Controls showInteractive={false} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
