/**
 * Agent Monitoring Dashboard — fully custom, no external services.
 * All data comes from the current session's processed claims.
 */
import React, { useMemo } from 'react'
import type { ClaimEntry } from './ActivityLogPanel'

const ORANGE = '#fa4e0a'

interface AgentEvent {
  timestamp: string
  agent: string
  type: 'thinking' | 'tool_use' | 'result' | 'error' | 'reasoning'
  content: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  claims: ClaimEntry[]
  isProcessing: boolean
  streamEvents?: AgentEvent[]
}

/* ── tiny helpers ─────────────────────────────────────────── */
const verdictColor = (v: string) => v === 'AUTO APPROVE' || v === 'APPROVE' ? '#16a34a' : v === 'MANUAL REVIEW' || v === 'FLAG' ? '#d97706' : '#dc2626'
const verdictBg    = (v: string) => v === 'AUTO APPROVE' || v === 'APPROVE' ? '#f0fdf4' : v === 'MANUAL REVIEW' || v === 'FLAG' ? '#fffbeb' : '#fef2f2'
const riskColor    = (p: number) => p >= 66 ? '#dc2626' : p >= 33 ? '#d97706' : '#16a34a'

const AGENTS = [
  { key: 'pii_masking', label: 'PII Masking', color: '#8b5cf6' },
  { key: 'loss_cause',  label: 'Loss Cause',  color: '#f59e0b' },
  { key: 'structured',  label: 'ML Model',    color: '#3b82f6' },
  { key: 'document',    label: 'Document',    color: '#f97316' },
  { key: 'visual',      label: 'Visual',      color: '#ec4899' },
  { key: 'web_search',  label: 'Web Search',  color: '#0ea5e9' },
  { key: 'fraud_ring',  label: 'Fraud Ring',  color: '#dc2626' },
  { key: 'adjudicator', label: 'Adjudicator', color: '#10b981' },
]

/* ── SVG icon paths (Lucide 24x24 viewBox) ────────────────── */
const ICON = {
  clipboard:   'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z',
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  brain:       'M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-1 5.83V15a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2.17A3 3 0 0 0 16 7V6a4 4 0 0 0-4-4z',
  database:    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5 M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  barChart:    'M18 20V10 M12 20V4 M6 20v-4',
  fileText:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  eye:         'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  scale:       'M12 3v18 M3 7l4 2 M17 7l4 2 M7 9l5-2 5 2 M7 9c0 3-2 5-4 7 M17 9c0 3 2 5 4 7 M3 16h8 M13 16h8',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  msgCircle:   'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  layers:      'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  chart:       'M3 3v18h18 M7 16v-4 M12 16V8 M17 16v-6',
  search:      'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  share2:      'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 0 0 0-6 3 3 0 0 0-2.04 5.19L8.91 11.1A3.002 3.002 0 0 0 3 12a3 3 0 0 0 5.91 1.1l7.05 4.11c-.05.21-.09.43-.09.66a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
} as const

/* ── KPI card ──────────────────────────────────────────────── */
const KpiCard = ({ label, value, sub, color, bg }: { label: string; value: string | number; sub?: string; color: string; bg: string }) => (
  <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: '10px', padding: '14px 16px', flex: 1 }}>
    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{sub}</div>}
  </div>
)

/* ── Section wrapper ───────────────────────────────────────── */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</span>
    </div>
    <div style={{ padding: '12px 14px' }}>{children}</div>
  </div>
)

/* ── Small SVG icon helper ────────────────────────────────── */
const SvgIcon = ({ d, size = 14, color = 'currentColor', strokeW = 2 }: { d: string; size?: number; color?: string; strokeW?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

/* ══════════════════════════════════════════════════════════════
   NETWORK DIAGRAM — rebuilt from scratch
   ══════════════════════════════════════════════════════════════ */

type NS = 'pending' | 'active' | 'done' | 'error'

const NetworkDiagram = ({ events, isProcessing }: { events: AgentEvent[]; isProcessing: boolean }) => {
  const hasEv   = (ag: string) => events.some(e => e.agent === ag)
  const isDone  = (ag: string) => events.some(e => e.agent === ag && e.type === 'result')
  const hasType = (ag: string, t: string) => events.some(e => e.agent === ag && e.type === t)

  const nodeState = (ag: string): NS => {
    if (isDone(ag)) return 'done'
    if (hasEv(ag) && isProcessing) return 'active'
    if (hasEv(ag)) return 'done'
    return 'pending'
  }

  // Derived states
  const claimState: NS   = events.length > 0 ? 'done' : (isProcessing ? 'active' : 'pending')
  const verdictState: NS = isDone('adjudicator') ? 'done' : (nodeState('adjudicator') === 'active' ? 'active' : 'pending')
  const lcDbState: NS    = hasType('loss_cause', 'tool_use') ? (isDone('loss_cause') ? 'done' : 'active') : 'pending'

  // Colors by state
  const stateColor  = (s: NS) => s === 'done' ? '#16a34a' : s === 'active' ? ORANGE : s === 'error' ? '#dc2626' : '#94a3b8'
  const stateGrad   = (s: NS) => s === 'done' ? 'gradDone' : s === 'active' ? 'gradActive' : s === 'error' ? 'gradError' : 'gradPending'
  const stateBorder = (s: NS) => s === 'done' ? '#86efac' : s === 'active' ? '#fb923c' : s === 'error' ? '#fca5a5' : '#d1d5db'
  const stateFilter = (s: NS) => s === 'active' ? 'url(#glowActive)' : s === 'done' ? 'url(#glowDone)' : 'url(#shadow)'
  const stateText   = (s: NS) => s === 'active' ? 'processing...' : s === 'done' ? 'complete' : 'waiting'

  /* ── LEFT-TO-RIGHT layout ─────────────────────────────────── */
  const W = 1600, H = 520
  const F = 'ui-sans-serif,system-ui,-apple-system,sans-serif'

  /*
   *  y=55:   [Chat LC]                                                      [Chat Adj]
   *  y=65:                            ┌→ [ML Model]    ─┐
   *  y=155:                           ├→ [Document]    ─┤
   *  y=245: [Claim]→[PII]→[LC]       ├→ [Visual]      ─┤→ [Adjudicator] → [Verdict]
   *              ↕                    ├→ [Web Search]  ─┤
   *  y=335:  [DB Lookup]              └→ [Fraud Ring]  ─┘
   */

  interface NodeDef { id: string; x: number; y: number; label: string; icon: string; state: NS; small?: boolean }

  const mainNodes: NodeDef[] = [
    { id: 'claim',       x: 100,  y: 245,  label: 'Claim Input',       icon: ICON.clipboard,   state: claimState },
    { id: 'pii',         x: 290,  y: 245,  label: 'PII Masking',       icon: ICON.shield,      state: nodeState('pii_masking') },
    { id: 'loss_cause',  x: 510,  y: 245,  label: 'Loss Cause Agent',  icon: ICON.brain,       state: nodeState('loss_cause') },
    { id: 'structured',  x: 840,  y: 65,   label: 'ML Model',          icon: ICON.barChart,    state: nodeState('structured') },
    { id: 'document',    x: 840,  y: 155,  label: 'Document Agent',    icon: ICON.fileText,    state: nodeState('document') },
    { id: 'visual',      x: 840,  y: 245,  label: 'Visual Agent',      icon: ICON.eye,         state: nodeState('visual') },
    { id: 'web_search',  x: 840,  y: 335,  label: 'Web Search',        icon: ICON.search,      state: nodeState('web_search') },
    { id: 'fraud_ring',  x: 840,  y: 425,  label: 'Fraud Ring',        icon: ICON.share2,      state: nodeState('fraud_ring') },
    { id: 'adjudicator', x: 1200, y: 245,  label: 'Adjudicator',       icon: ICON.scale,       state: nodeState('adjudicator') },
    { id: 'verdict',     x: 1450, y: 245,  label: 'Final Verdict',     icon: ICON.checkCircle, state: verdictState },
  ]

  const subNodes: NodeDef[] = [
    { id: 'lc_db',    x: 510,  y: 420,  label: 'DB Lookup',       icon: ICON.database,  state: lcDbState,           small: true },
    { id: 'chat_lc',  x: 510,  y: 55,   label: 'Follow-up Chat',  icon: ICON.msgCircle, state: 'pending' as NS,     small: true },
    { id: 'chat_adj', x: 1200, y: 55,   label: 'Follow-up Chat',  icon: ICON.msgCircle, state: 'pending' as NS,     small: true },
  ]

  /* ── Edge definitions (horizontal bezier curves) ──────────── */
  interface EdgeDef { id: string; d: string; done: boolean; active: boolean; main: boolean; chat?: boolean; bidir?: boolean }

  // Node half-widths: main=80, sub=65. Half-heights: main=25, sub=19
  const edges: EdgeDef[] = [
    // Main horizontal flow
    { id: 'claim-pii',  d: 'M180,245 C205,245 205,245 210,245',      done: hasEv('pii_masking'),  active: events.length > 0,    main: true },
    { id: 'pii-lc',     d: 'M370,245 C400,245 405,245 430,245',      done: hasEv('loss_cause'),   active: isDone('pii_masking'), main: true },

    // Loss Cause → all 5 parallel agents (fan-out)
    { id: 'lc-ml',      d: 'M590,245 C680,245 710,65  760,65',       done: hasEv('structured'),  active: isDone('loss_cause'), main: true },
    { id: 'lc-doc',     d: 'M590,245 C680,245 710,155 760,155',      done: hasEv('document'),    active: isDone('loss_cause'), main: true },
    { id: 'lc-vis',     d: 'M590,245 C680,245 710,245 760,245',      done: hasEv('visual'),      active: isDone('loss_cause'), main: true },
    { id: 'lc-ws',      d: 'M590,245 C680,245 710,335 760,335',      done: hasEv('web_search'),  active: isDone('loss_cause'), main: true },
    { id: 'lc-fr',      d: 'M590,245 C680,245 710,425 760,425',      done: hasEv('fraud_ring'),  active: isDone('loss_cause'), main: true },

    // All 5 parallel agents → Adjudicator (converge)
    { id: 'ml-adj',     d: 'M920,65  C990,65  1050,245 1120,245',    done: isDone('adjudicator'), active: isDone('structured'),  main: true },
    { id: 'doc-adj',    d: 'M920,155 C990,155 1050,245 1120,245',    done: isDone('adjudicator'), active: isDone('document'),    main: true },
    { id: 'vis-adj',    d: 'M920,245 C990,245 1050,245 1120,245',    done: isDone('adjudicator'), active: isDone('visual'),      main: true },
    { id: 'ws-adj',     d: 'M920,335 C990,335 1050,245 1120,245',    done: isDone('adjudicator'), active: isDone('web_search'),  main: true },
    { id: 'fr-adj',     d: 'M920,425 C990,425 1050,245 1120,245',    done: isDone('adjudicator'), active: isDone('fraud_ring'),  main: true },

    // Adjudicator → Verdict
    { id: 'adj-verd',   d: 'M1280,245 C1330,245 1345,245 1370,245',  done: isDone('adjudicator'), active: nodeState('adjudicator') !== 'pending', main: true },

    // Loss Cause ↔ DB Lookup (bidirectional vertical)
    { id: 'lc-db',      d: 'M510,270 C510,330 510,375 510,401',      done: hasType('loss_cause','tool_use'), active: hasEv('loss_cause'), main: false, bidir: true },

    // Chat edges (vertical dashed)
    { id: 'lc-chat',    d: 'M510,220 C510,170 510,110 510,74',       done: false, active: false, main: false, chat: true },
    { id: 'adj-chat',   d: 'M1200,220 C1200,160 1200,100 1200,74',   done: false, active: false, main: false, chat: true },
  ]

  /* ── NodeBox renderer ─────────────────────────────────────── */
  const NodeBox = ({ x, y, label, icon, state, small = false }: NodeDef) => {
    const w = small ? 130 : 160
    const h = small ? 38 : 50
    const rx = small ? 8 : 12
    const iconR = small ? 12 : 16
    const iconX = x - w / 2 + iconR + 10
    const textX = iconX + iconR + 8
    const sc = small ? 0.5 : 0.58
    const iconOff = 12 * sc

    return (
      <g>
        {/* Background rect */}
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={rx}
          fill={`url(#${stateGrad(state)})`}
          stroke={stateBorder(state)}
          strokeWidth={state === 'active' ? 2 : 1.2}
          filter={stateFilter(state)}
        />
        {/* Active pulse ring */}
        {state === 'active' && (
          <rect x={x - w / 2 - 3} y={y - h / 2 - 3} width={w + 6} height={h + 6} rx={rx + 3}
            fill="none" stroke={ORANGE} strokeWidth="1.5">
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur="1.5s" repeatCount="indefinite" />
          </rect>
        )}
        {/* Icon circle */}
        <circle cx={iconX} cy={y} r={iconR}
          fill={stateColor(state)} opacity={state === 'pending' ? 0.6 : 1}
        />
        {/* Icon SVG path */}
        <g transform={`translate(${iconX - iconOff},${y - iconOff}) scale(${sc})`}>
          <path d={icon} fill="none" stroke="#fff" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {/* Label */}
        <text x={textX} y={small ? y + 4 : y - 2} fontSize={small ? 11 : 12} fontWeight={600}
          fill="#374151" fontFamily={F}>
          {label}
        </text>
        {/* Status text (main only) */}
        {!small && (
          <text x={textX} y={y + 14} fontSize={9} fill={stateColor(state)} opacity={0.8} fontFamily={F}>
            {stateText(state)}
          </text>
        )}
      </g>
    )
  }

  /* ── EdgePath renderer ────────────────────────────────────── */
  const EdgePath = ({ d, done, active, main, chat, bidir }: EdgeDef) => {
    const color = done ? '#16a34a' : active ? '#d1d5db' : '#e2e8f0'
    const sw = main ? 2 : 1.5
    const dash = done ? 'none' : chat ? '6 4' : '8 5'
    const arrow = chat ? undefined : `url(#arr-${done ? 'green' : active ? 'gray' : 'light'})`

    return (
      <g>
        {/* Glow behind for done edges */}
        {done && main && (
          <path d={d} fill="none" stroke="#16a34a" strokeWidth={sw + 4} opacity={0.1} strokeLinecap="round" />
        )}
        {/* Main path */}
        <path d={d} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={dash} strokeLinecap="round" markerEnd={arrow}
          markerStart={bidir ? `url(#arr-rev-${done ? 'green' : active ? 'gray' : 'light'})` : undefined}>
          {active && !done && (
            <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.8s" repeatCount="indefinite" />
          )}
        </path>
        {/* Reverse arrow for chat */}
        {chat && (
          <path d={d} fill="none" stroke="#e2e8f0" strokeWidth={1.2}
            strokeDasharray="6 4" strokeLinecap="round" />
        )}
      </g>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Agent Network Flow
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          {([['done', '#16a34a', 'Complete'], ['active', ORANGE, 'Active'], ['pending', '#94a3b8', 'Waiting']] as const).map(([s, c, l]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block',
                boxShadow: s === 'active' ? `0 0 6px ${c}80` : 'none' }} />
              <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 500 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG canvas */}
      <div style={{ padding: '12px 8px', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', width: '100%', height: 'auto' }}>

          {/* ── Defs ────────────────────────────────────────── */}
          <defs>
            {/* Gradients */}
            <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9fafb" />
              <stop offset="100%" stopColor="#f3f4f6" />
            </linearGradient>
            <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#ffedd5" />
            </linearGradient>
            <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#dcfce7" />
            </linearGradient>
            <linearGradient id="gradError" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef2f2" />
              <stop offset="100%" stopColor="#fecaca" />
            </linearGradient>

            {/* Drop shadow */}
            <filter id="shadow" x="-8%" y="-8%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0000000d" />
            </filter>
            {/* Active glow */}
            <filter id="glowActive" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b" />
              <feFlood floodColor={ORANGE} floodOpacity="0.25" result="c" />
              <feComposite in="c" in2="b" operator="in" result="g" />
              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Done glow */}
            <filter id="glowDone" x="-12%" y="-12%" width="126%" height="126%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b" />
              <feFlood floodColor="#16a34a" floodOpacity="0.18" result="c" />
              <feComposite in="c" in2="b" operator="in" result="g" />
              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Arrow markers (forward) */}
            <marker id="arr-green" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L0,8 L10,4 z" fill="#16a34a" opacity="0.8" />
            </marker>
            <marker id="arr-gray" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L0,8 L10,4 z" fill="#d1d5db" opacity="0.7" />
            </marker>
            <marker id="arr-light" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L0,8 L10,4 z" fill="#e2e8f0" opacity="0.6" />
            </marker>
            {/* Arrow markers (reverse, for bidirectional edges) */}
            <marker id="arr-rev-green" markerWidth="10" markerHeight="8" refX="2" refY="4" orient="auto-start-reverse">
              <path d="M0,0 L0,8 L10,4 z" fill="#16a34a" opacity="0.8" />
            </marker>
            <marker id="arr-rev-gray" markerWidth="10" markerHeight="8" refX="2" refY="4" orient="auto-start-reverse">
              <path d="M0,0 L0,8 L10,4 z" fill="#d1d5db" opacity="0.7" />
            </marker>
            <marker id="arr-rev-light" markerWidth="10" markerHeight="8" refX="2" refY="4" orient="auto-start-reverse">
              <path d="M0,0 L0,8 L10,4 z" fill="#e2e8f0" opacity="0.6" />
            </marker>
          </defs>

          {/* ── Background regions ──────────────────────────── */}

          {/* DB Lookup zone (below Loss Cause) */}
          <rect x={445} y={393} width={130} height={54} rx={10}
            fill="#fefce8" stroke="#fde68a" strokeWidth={0.8} strokeDasharray="6 3" opacity={0.5} />
          <text x={510} y={387} textAnchor="middle" fontSize={9.5}
            fill="#a16207" fontWeight={600} letterSpacing={0.8} fontFamily={F}>
            VECTOR SEARCH
          </text>

          {/* Parallel execution zone — all 5 agents */}
          <rect x={755} y={36} width={170} height={415} rx={10}
            fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} strokeDasharray="8 4" opacity={0.7} />
          <text x={840} y={462} textAnchor="middle" fontSize={9.5}
            fill="#64748b" fontWeight={600} letterSpacing={0.8} fontFamily={F}>
            PARALLEL EXECUTION
          </text>

          {/* ── Edges (drawn behind nodes) ──────────────────── */}
          {edges.map(e => <EdgePath key={e.id} {...e} />)}

          {/* ── Main nodes ──────────────────────────────────── */}
          {mainNodes.map(n => <NodeBox key={n.id} {...n} />)}

          {/* ── Sub nodes ───────────────────────────────────── */}
          {subNodes.map(n => <NodeBox key={n.id} {...n} />)}

          {/* ── Merge point pulse (at adjudicator left edge) ── */}
          {isProcessing && (isDone('structured') || isDone('document') || isDone('visual') || isDone('web_search') || isDone('fraud_ring')) && !isDone('adjudicator') && (
            <circle cx={1120} cy={245} r={6} fill="none" stroke={ORANGE} strokeWidth={1.5}>
              <animate attributeName="r" values="6;16;6" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}

        </svg>
      </div>
    </div>
  )
}

/* ── Legend (SVG icons, no emoji) ──────────────────────────── */
const LEGEND_ITEMS = [
  { icon: ICON.clipboard,   name: 'Claim Input',        desc: 'Entry point for claim data',        color: '#6b7280' },
  { icon: ICON.shield,      name: 'PII Masking',        desc: 'Detects & masks personal data',     color: '#8b5cf6' },
  { icon: ICON.brain,       name: 'Loss Cause Agent',   desc: 'LLM classification with taxonomy',  color: '#f59e0b' },
  { icon: ICON.database,    name: 'DB Lookup',          desc: 'ChromaDB vector search',            color: '#3b82f6' },
  { icon: ICON.barChart,    name: 'ML Model',           desc: 'XGBoost fraud scoring',             color: '#3b82f6' },
  { icon: ICON.fileText,    name: 'Document Agent',     desc: 'LLM document analysis',             color: '#f97316' },
  { icon: ICON.eye,         name: 'Visual Agent',       desc: 'Image forensics analysis',          color: '#ec4899' },
  { icon: ICON.search,      name: 'Web Search',         desc: 'Tavily weather & accident search',  color: '#0ea5e9' },
  { icon: ICON.share2,      name: 'Fraud Ring',         desc: 'Network CSV fraud ring analysis',   color: '#dc2626' },
  { icon: ICON.scale,       name: 'Adjudicator',        desc: 'Synthesis & final verdict',         color: '#10b981' },
  { icon: ICON.checkCircle, name: 'Final Verdict',      desc: 'AUTO APPROVE / MANUAL REVIEW / SIU', color: '#16a34a' },
  { icon: ICON.msgCircle,   name: 'Follow-up Chat',     desc: 'User Q&A (no reasoning)',           color: '#6b7280' },
]

const Legend = () => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px' }}>
    <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
      Node Types
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px 8px' }}>
      {LEGEND_ITEMS.map(item => (
        <div key={item.name} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: item.color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0
          }}>
            <SvgIcon d={item.icon} size={13} color="#fff" strokeW={2} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>{item.name}</div>
            <div style={{ fontSize: '9px', color: '#9ca3af', lineHeight: 1.3 }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

/* ══════════════════════════════════════════════════════════════
   MAIN PANEL EXPORT
   ══════════════════════════════════════════════════════════════ */

export default function AgentMonitoringPanel({ isOpen, onClose, claims = [], isProcessing, streamEvents = [] }: Props) {
  const [activeTab, setActiveTab] = React.useState<'analytics' | 'network'>('network')

  /* ── Derived stats ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const n = claims.length
    if (n === 0) return { n: 0, approved: 0, flagged: 0, rejected: 0, avgRisk: 0, highRisk: 0, needsReview: 0 }
    const approved = claims.filter(c => c.verdict === 'AUTO APPROVE' || c.verdict === 'APPROVE').length
    const flagged  = claims.filter(c => c.verdict === 'MANUAL REVIEW' || c.verdict === 'FLAG').length
    const rejected = claims.filter(c => c.verdict === 'SIU' || c.verdict === 'REJECT').length
    const avgRisk  = claims.reduce((s, c) => s + c.fraud_probability, 0) / n
    const highRisk = claims.filter(c => c.fraud_probability >= 66).length
    return { n, approved, flagged, rejected, avgRisk, highRisk, needsReview: flagged + rejected }
  }, [claims])

  /* ── Histogram: 5 buckets 0-20, 20-40, 40-60, 60-80, 80-100 ── */
  const histBuckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0]
    claims.forEach(c => { b[Math.min(Math.floor(c.fraud_probability / 20), 4)]++ })
    return b
  }, [claims])
  const histMax = Math.max(...histBuckets, 1)

  /* ── Loss cause taxonomy ─────────────────────────────────── */
  const taxonomy = useMemo(() => {
    const counts: Record<string, number> = {}
    claims.forEach(c => {
      if (c.loss_cause_primary) counts[c.loss_cause_primary] = (counts[c.loss_cause_primary] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [claims])
  const taxMax = taxonomy[0]?.[1] || 1

  if (!isOpen) return null

  const isEmpty = claims.length === 0

  /* ── Tab definitions (SVG icons, no emoji) ── */
  const tabs = [
    { key: 'network' as const, label: 'Network Flow', icon: ICON.layers },
    { key: 'analytics' as const, label: 'Analytics', icon: ICON.chart },
  ]

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 40, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, left: '60px',
        background: '#f3f4f6', zIndex: 50,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}>

        {/* ── Header bar ── */}
        <div style={{
          padding: '12px 20px', flexShrink: 0,
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          borderBottom: '1px solid #374151',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Agent Monitoring</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Built-in Analytics Dashboard</div>
          </div>
          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#dc262620', border: '1px solid #dc262640', borderRadius: '20px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'apPulse 1s infinite' }} />
              <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>LIVE</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
            <span>{claims.length} claim{claims.length !== 1 ? 's' : ''} this session</span>
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #4b5563', background: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '15px', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18 M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px', fontSize: '12px', fontWeight: 600,
                border: 'none', cursor: 'pointer', background: 'transparent',
                color: activeTab === tab.key ? ORANGE : '#6b7280',
                borderBottom: activeTab === tab.key ? `2px solid ${ORANGE}` : '2px solid transparent',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              <SvgIcon d={tab.icon} size={14} color={activeTab === tab.key ? ORANGE : '#9ca3af'} strokeW={2} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Network tab ── */}
          {activeTab === 'network' && (
            <>
              <NetworkDiagram events={streamEvents} isProcessing={isProcessing} />
              <Legend />
            </>
          )}

          {/* ── Analytics tab ── */}
          {activeTab === 'analytics' && (isEmpty ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '80px 20px', color: '#9ca3af' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>No data yet</div>
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                  Submit and process a claim to start seeing<br />real-time analytics here.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ── Row 1: KPI cards ── */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <KpiCard label="Claims Processed" value={stats.n} sub="this session" color="#3b82f6" bg="#eff6ff" />
                <KpiCard label="Avg Fraud Risk" value={stats.avgRisk >= 66 ? 'High' : stats.avgRisk >= 33 ? 'Moderate' : 'Low'} sub={stats.avgRisk >= 66 ? 'Elevated' : 'Normal range'} color={riskColor(stats.avgRisk)} bg={stats.avgRisk >= 66 ? '#fef2f2' : stats.avgRisk >= 33 ? '#fffbeb' : '#f0fdf4'} />
                <KpiCard label="High Risk" value={stats.highRisk} sub="High risk claims" color="#dc2626" bg="#fef2f2" />
                <KpiCard label="Need Review" value={stats.needsReview} sub="SIU or Manual Review" color="#d97706" bg="#fffbeb" />
              </div>

              {/* ── Row 2: Verdict + Risk Histogram ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                {/* Verdict Distribution */}
                <Section title="Verdict Distribution">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(['AUTO APPROVE', 'MANUAL REVIEW', 'SIU'] as const).map(v => {
                      const count = v === 'AUTO APPROVE' ? stats.approved : v === 'MANUAL REVIEW' ? stats.flagged : stats.rejected
                      const pct = stats.n > 0 ? (count / stats.n) * 100 : 0
                      return (
                        <div key={v}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '12px', background: verdictBg(v), border: `1px solid ${verdictColor(v)}30`, fontSize: '10px', fontWeight: 700, color: verdictColor(v) }}>{v}</span>
                              <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{count}</span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{count} of {stats.n}</span>
                          </div>
                          <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: verdictColor(v), borderRadius: '4px', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Mini donut visual */}
                  <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                    {(['AUTO APPROVE', 'MANUAL REVIEW', 'SIU'] as const).map(v => {
                      const count = v === 'AUTO APPROVE' ? stats.approved : v === 'MANUAL REVIEW' ? stats.flagged : stats.rejected
                      return (
                        <div key={v} style={{ textAlign: 'center' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: verdictBg(v), border: `3px solid ${verdictColor(v)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: verdictColor(v) }}>{count}</span>
                          </div>
                          <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600 }}>{v}</span>
                        </div>
                      )
                    })}
                  </div>
                </Section>

                {/* Fraud Risk Histogram */}
                <Section title="Fraud Risk Distribution">
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px', padding: '0 4px' }}>
                    {histBuckets.map((count, i) => {
                      const pct = (count / histMax) * 100
                      const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
                      const colors = ['#16a34a', '#84cc16', '#f59e0b', '#f97316', '#dc2626']
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: count > 0 ? colors[i] : '#d1d5db' }}>{count}</span>
                          <div style={{ width: '100%', height: `${Math.max(pct, count > 0 ? 8 : 0)}%`, background: colors[i], borderRadius: '4px 4px 0 0', opacity: count === 0 ? 0.25 : 1, transition: 'height 0.5s ease', minHeight: count > 0 ? '8px' : '0' }} />
                          <span style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{labels[i]}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Min Risk: <strong style={{ color: '#16a34a' }}>{claims.length > 0 ? (() => { const v = Math.min(...claims.map(c => c.fraud_probability)); return v >= 66 ? 'High' : v >= 33 ? 'Moderate' : 'Low' })() : '-'}</strong></span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Avg Risk: <strong style={{ color: riskColor(stats.avgRisk) }}>{stats.avgRisk >= 66 ? 'High' : stats.avgRisk >= 33 ? 'Moderate' : 'Low'}</strong></span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Max Risk: <strong style={{ color: '#dc2626' }}>{claims.length > 0 ? (() => { const v = Math.max(...claims.map(c => c.fraud_probability)); return v >= 66 ? 'High' : v >= 33 ? 'Moderate' : 'Low' })() : '-'}</strong></span>
                  </div>
                </Section>
              </div>

              {/* ── Row 3: Agent Pipeline + Loss Cause ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                {/* Agent Pipeline Status */}
                <Section title="Agent Pipeline Status">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '14px' }}>
                    {AGENTS.map((ag, i) => (
                      <div key={ag.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: ag.color + '20', border: `2px solid ${ag.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: stats.n > 0 ? ag.color : '#d1d5db', display: 'inline-block' }} />
                          </div>
                          <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{ag.label}</span>
                        </div>
                        {i < AGENTS.length - 1 && (
                          <div style={{ width: '20px', height: '2px', background: stats.n > 0 ? '#d1d5db' : '#f3f4f6', flexShrink: 0, marginBottom: '18px' }}>
                            {stats.n > 0 && <div style={{ height: '100%', background: `linear-gradient(to right, ${AGENTS[i].color}, ${AGENTS[i + 1].color})` }} />}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[
                      { label: 'Runs',          value: stats.n,                 color: '#3b82f6' },
                      { label: 'Completed',      value: stats.n - 0,            color: '#16a34a' },
                      { label: 'Avg Agents/Run', value: stats.n > 0 ? '8' : '0', color: '#8b5cf6' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: '#f9fafb', borderRadius: '7px', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Loss Cause Taxonomy */}
                <Section title="Loss Cause Taxonomy">
                  {taxonomy.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', padding: '20px 0' }}>No taxonomy data yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {taxonomy.map(([cause, count], i) => (
                        <div key={cause}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '11px', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>{cause}</span>
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{count}</span>
                              <span style={{ fontSize: '10px', color: '#9ca3af' }}>{stats.n > 0 ? Math.round((count / stats.n) * 100) : 0}%</span>
                            </div>
                          </div>
                          <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(count / taxMax) * 100}%`, background: i === 0 ? `linear-gradient(to right, ${ORANGE}, #fb923c)` : i < 3 ? '#f97316' : '#d1d5db', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              {/* ── Row 4: Recent claims table ── */}
              <Section title="Recent Claims">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Claim ID', 'Time', 'Verdict', 'Fraud Risk', 'Primary Loss Cause', 'Confidence'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...claims].reverse().slice(0, 20).map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827', fontFamily: 'monospace', fontSize: '11px' }}>{c.claim_id}</td>
                          <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{c.timestamp}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', background: verdictBg(c.verdict), border: `1px solid ${verdictColor(c.verdict)}30`, fontSize: '10px', fontWeight: 700, color: verdictColor(c.verdict) }}>{c.verdict}</span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: riskColor(c.fraud_probability) }}>
                              {c.fraud_probability >= 66 ? 'High' : c.fraud_probability >= 33 ? 'Moderate' : 'Low'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#374151', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.loss_cause_primary}</td>
                          <td style={{ padding: '8px 10px', color: '#6b7280' }}>
                            {c.loss_cause_confidence != null ? `${c.loss_cause_confidence}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          ))}
        </div>
      </div>

      <style>{`@keyframes apPulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </>
  )
}
