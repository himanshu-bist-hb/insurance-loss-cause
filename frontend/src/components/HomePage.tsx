/**
 * HOME PAGE — Concept 6: Cyberpunk Investigation Board
 *
 * A noir detective's investigation board reimagined for the AI age.
 * Agent "case files" are pinned to a dark slate board, connected by
 * glowing neon strings. Evidence fragments scatter around. A central
 * "CASE ACTIVE" LED display holds the search bar. CRT scan lines
 * overlay everything.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import exlLogo from '../assets/images/exl_logo.png'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'
const CYAN = '#00e5ff'
const BG = '#0d1117'
const NEON_ORANGE = '#ff6a1a'
const NEON_CYAN = '#00d4ff'

const AGENTS = [
  { name: 'Loss Cause', icon: '📉', color: '#10b981', desc: 'Classifying loss causes from claim notes', x: 0.12, y: 0.18, rot: -2.5 },
  { name: 'ML Model', icon: '🧠', color: '#f97316', desc: 'XGBoost fraud probability scoring', x: 0.62, y: 0.12, rot: 1.8 },
  { name: 'Document', icon: '📄', color: '#3b82f6', desc: 'Extracting fields from claim documents', x: 0.82, y: 0.30, rot: -1.5 },
  { name: 'Visual AI', icon: '👁', color: '#8b5cf6', desc: 'Image authenticity analysis', x: 0.10, y: 0.58, rot: 2.2 },
  { name: 'Web Search', icon: '🌐', color: '#06b6d4', desc: 'Open-source intelligence gathering', x: 0.65, y: 0.60, rot: -3.0 },
  { name: 'Fraud Ring', icon: '🔗', color: '#f59e0b', desc: 'Entity network analysis', x: 0.36, y: 0.42, rot: 1.0 },
]

// Connections: index pairs for strings between agents
const CONNECTIONS: [number, number][] = [
  [0, 5], [5, 1], [1, 2], [2, 4], [4, 3], [3, 0], [5, 4], [0, 1], [3, 5],
]

// Evidence snippets scattered around
const EVIDENCE = [
  { text: '[CLASSIFIED]', x: 0.48, y: 0.08, rot: -1 },
  { text: 'CLAIM #4721-B', x: 0.28, y: 0.78, rot: 2.5 },
  { text: 'SUSPICIOUS', x: 0.88, y: 0.72, rot: -2 },
  { text: '██████████', x: 0.04, y: 0.82, rot: 1.5 },
  { text: 'REF: NW-0093', x: 0.78, y: 0.82, rot: -1.8 },
  { text: 'PRIORITY: HIGH', x: 0.50, y: 0.88, rot: 0.5 },
]

// ─── Canvas Scene ───────────────────────────────────────────

function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, frame = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas!.width = w * dpr; canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // String glow pulses
    interface Pulse { conn: number; t: number; speed: number }
    const pulses: Pulse[] = []
    for (let i = 0; i < 12; i++) {
      pulses.push({
        conn: Math.floor(Math.random() * CONNECTIONS.length),
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
      })
    }

    function drawBoardTexture() {
      // Subtle grid lines on the board
      ctx!.save()
      ctx!.strokeStyle = 'rgba(255,255,255,0.015)'
      ctx!.lineWidth = 0.5
      const step = 30
      for (let x = 0; x < w; x += step) {
        ctx!.beginPath()
        ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke()
      }
      for (let y = 0; y < h; y += step) {
        ctx!.beginPath()
        ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke()
      }
      ctx!.restore()
    }

    function drawNeonBorder() {
      // Neon orange and cyan light strips along edges
      ctx!.save()

      // Top edge - orange
      const topGrad = ctx!.createLinearGradient(0, 0, w, 0)
      topGrad.addColorStop(0, 'rgba(255,106,26,0)')
      topGrad.addColorStop(0.3, 'rgba(255,106,26,0.15)')
      topGrad.addColorStop(0.7, 'rgba(255,106,26,0.15)')
      topGrad.addColorStop(1, 'rgba(255,106,26,0)')
      ctx!.fillStyle = topGrad
      ctx!.fillRect(0, 0, w, 3)

      // Bloom
      const topBloom = ctx!.createLinearGradient(0, 0, 0, 20)
      topBloom.addColorStop(0, 'rgba(255,106,26,0.06)')
      topBloom.addColorStop(1, 'rgba(255,106,26,0)')
      ctx!.fillStyle = topBloom
      ctx!.fillRect(0, 0, w, 20)

      // Bottom edge - cyan
      const botGrad = ctx!.createLinearGradient(0, 0, w, 0)
      botGrad.addColorStop(0, 'rgba(0,212,255,0)')
      botGrad.addColorStop(0.3, 'rgba(0,212,255,0.12)')
      botGrad.addColorStop(0.7, 'rgba(0,212,255,0.12)')
      botGrad.addColorStop(1, 'rgba(0,212,255,0)')
      ctx!.fillStyle = botGrad
      ctx!.fillRect(0, h - 3, w, 3)

      const botBloom = ctx!.createLinearGradient(0, h - 20, 0, h)
      botBloom.addColorStop(0, 'rgba(0,212,255,0)')
      botBloom.addColorStop(1, 'rgba(0,212,255,0.04)')
      ctx!.fillStyle = botBloom
      ctx!.fillRect(0, h - 20, w, 20)

      // Occasional flicker
      if (Math.random() < 0.005) {
        ctx!.globalAlpha = 0.3
        ctx!.fillStyle = NEON_ORANGE
        ctx!.fillRect(0, 0, w, 2)
        ctx!.globalAlpha = 1
      }

      ctx!.restore()
    }

    function drawStrings(t: number) {
      CONNECTIONS.forEach(([ai, bi], ci) => {
        const a = AGENTS[ai]
        const b = AGENTS[bi]
        const ax = a.x * w, ay = a.y * h
        const bx = b.x * w, by = b.y * h

        // String droop (quadratic bezier)
        const midX = (ax + bx) / 2
        const midY = (ay + by) / 2 + 25 // droop down

        // Determine color: alternate orange and cyan
        const color = ci % 2 === 0 ? NEON_ORANGE : NEON_CYAN

        // Base string
        ctx!.save()
        ctx!.strokeStyle = color
        ctx!.lineWidth = 1
        ctx!.globalAlpha = 0.2
        ctx!.beginPath()
        ctx!.moveTo(ax, ay)
        ctx!.quadraticCurveTo(midX, midY, bx, by)
        ctx!.stroke()

        // Glow
        ctx!.lineWidth = 4
        ctx!.globalAlpha = 0.04
        ctx!.beginPath()
        ctx!.moveTo(ax, ay)
        ctx!.quadraticCurveTo(midX, midY, bx, by)
        ctx!.stroke()

        ctx!.restore()
      })

      // Draw pulses on strings
      pulses.forEach(p => {
        p.t += p.speed
        if (p.t > 1) {
          p.t = 0
          p.conn = Math.floor(Math.random() * CONNECTIONS.length)
          p.speed = 0.003 + Math.random() * 0.005
        }

        const [ai, bi] = CONNECTIONS[p.conn]
        const a = AGENTS[ai]
        const b = AGENTS[bi]
        const ax = a.x * w, ay = a.y * h
        const bx = b.x * w, by = b.y * h
        const midX = (ax + bx) / 2
        const midY = (ay + by) / 2 + 25

        // Quadratic bezier point
        const tt = p.t
        const px = (1 - tt) * (1 - tt) * ax + 2 * (1 - tt) * tt * midX + tt * tt * bx
        const py = (1 - tt) * (1 - tt) * ay + 2 * (1 - tt) * tt * midY + tt * tt * by

        const color = p.conn % 2 === 0 ? NEON_ORANGE : NEON_CYAN

        const glow = ctx!.createRadialGradient(px, py, 0, px, py, 8)
        glow.addColorStop(0, color)
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(px, py, 8, 0, Math.PI * 2)
        ctx!.fill()

        // Core dot
        ctx!.fillStyle = '#fff'
        ctx!.globalAlpha = 0.8
        ctx!.beginPath()
        ctx!.arc(px, py, 2, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.globalAlpha = 1
      })
    }

    function drawPins() {
      AGENTS.forEach(agent => {
        const px = agent.x * w
        const py = agent.y * h - 30 // pin above card

        // Pin shadow
        ctx!.fillStyle = 'rgba(0,0,0,0.3)'
        ctx!.beginPath()
        ctx!.arc(px + 1, py + 1, 5, 0, Math.PI * 2)
        ctx!.fill()

        // Pin
        ctx!.fillStyle = agent.color
        ctx!.beginPath()
        ctx!.arc(px, py, 5, 0, Math.PI * 2)
        ctx!.fill()

        // Pin highlight
        ctx!.fillStyle = 'rgba(255,255,255,0.4)'
        ctx!.beginPath()
        ctx!.arc(px - 1.5, py - 1.5, 1.5, 0, Math.PI * 2)
        ctx!.fill()
      })
    }

    function drawEvidence(t: number) {
      EVIDENCE.forEach((ev, i) => {
        const ex = ev.x * w
        const ey = ev.y * h
        // Slow drift
        const dx = Math.sin(t * 0.0008 + i * 2) * 3
        const dy = Math.cos(t * 0.001 + i * 3) * 2

        ctx!.save()
        ctx!.translate(ex + dx, ey + dy)
        ctx!.rotate((ev.rot * Math.PI) / 180)
        ctx!.font = '8px "Courier New", monospace'
        ctx!.fillStyle = ev.text === '[CLASSIFIED]' || ev.text === 'SUSPICIOUS' || ev.text === 'PRIORITY: HIGH'
          ? 'rgba(239,68,68,0.25)'
          : 'rgba(255,255,255,0.12)'
        ctx!.textAlign = 'center'
        ctx!.fillText(ev.text, 0, 0)

        // Redacted bar for the blacked-out one
        if (ev.text === '██████████') {
          ctx!.fillStyle = 'rgba(255,255,255,0.08)'
          ctx!.fillRect(-35, -8, 70, 12)
        }

        ctx!.restore()
      })
    }

    function drawScanLines() {
      ctx!.save()
      // CRT horizontal scan lines
      ctx!.fillStyle = 'rgba(255,255,255,0.008)'
      for (let y = 0; y < h; y += 3) {
        ctx!.fillRect(0, y, w, 1)
      }

      // Moving scan line
      const scanY = (frame * 0.3) % h
      const grad = ctx!.createLinearGradient(0, scanY - 30, 0, scanY + 30)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.02)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, scanY - 30, w, 60)
      ctx!.restore()
    }

    function draw() {
      frame++
      ctx!.fillStyle = BG
      ctx!.fillRect(0, 0, w, h)

      drawBoardTexture()
      drawStrings(frame)
      drawEvidence(frame)
      drawPins()
      drawNeonBorder()
      drawScanLines()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
  )
}

// ─── Agent Case File Card (HTML overlay) ────────────────────

function CaseFileCard({ agent }: { agent: typeof AGENTS[number] }) {
  const [wobble, setWobble] = useState(agent.rot)

  useEffect(() => {
    // Slow gentle wobble like hanging from a pin
    let frame = 0
    const interval = setInterval(() => {
      frame++
      setWobble(agent.rot + Math.sin(frame * 0.03) * 0.5)
    }, 50)
    return () => clearInterval(interval)
  }, [agent.rot])

  return (
    <div style={{
      position: 'absolute',
      left: `${agent.x * 100}%`,
      top: `${agent.y * 100}%`,
      transform: `translate(-50%, -50%) rotate(${wobble}deg)`,
      width: 140,
      background: 'rgba(20,22,30,0.85)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 2,
      padding: '14px 12px 10px',
      // Torn edge on right side via clip-path
      clipPath: `polygon(
        0 0, 100% 0, 100% 10%, 98% 12%, 100% 15%, 99% 18%, 100% 22%,
        100% 100%, 0 100%
      )`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      {/* Paper texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255,255,255,0.005) 4px, rgba(255,255,255,0.005) 5px)',
        pointerEvents: 'none',
      }} />

      <div style={{ fontSize: 20, marginBottom: 6 }}>{agent.icon}</div>
      <p style={{
        fontFamily: '"Courier New", monospace',
        fontSize: '0.7rem', fontWeight: 700,
        color: agent.color, letterSpacing: 1,
        textTransform: 'uppercase', marginBottom: 4,
      }}>{agent.name}</p>
      <p style={{
        fontFamily: '"Courier New", monospace',
        fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)',
        lineHeight: 1.4,
      }}>{agent.desc}</p>

      {/* Status LED */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: agent.color,
          boxShadow: `0 0 6px ${agent.color}`,
          animation: 'pulse-led 2s ease-in-out infinite',
        }} />
        <span style={{
          fontFamily: '"Courier New", monospace',
          fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase',
        }}>Active</span>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────

interface HomePageProps {
  onPolicySelected: (policyId: string, policyData: any) => void
  onGoToDashboard?: () => void
}

const CAPABILITIES = [
  { title: 'Multi-Agent AI', desc: 'Six specialized agents collaborate in real-time' },
  { title: 'Fraud Ring Detection', desc: 'Graph-based network analysis' },
  { title: 'Visual Forensics', desc: 'Image authenticity verification' },
  { title: 'Instant Verdicts', desc: 'Automated adjudication with scoring' },
]

export default function HomePage({ onPolicySelected, onGoToDashboard }: HomePageProps) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = useCallback(async () => {
    const trimmed = search.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error('Claim not found')
      const data = await res.json()
      onPolicySelected(trimmed, data)
    } catch {
      setError('Claim not found. Check the Policy ID and try again.')
    } finally {
      setLoading(false)
    }
  }, [search, onPolicySelected])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh',
      overflow: 'hidden', background: BG,
    }}>
      {/* Canvas background */}
      <BoardCanvas />

      {/* Agent case file cards */}
      {AGENTS.map((agent, i) => (
        <CaseFileCard key={i} agent={agent} />
      ))}

      {/* Central "CASE ACTIVE" panel */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        textAlign: 'center',
      }}>
        {/* EXL Logo */}
        <img src={exlLogo} alt="EXL" style={{ height: 48, marginBottom: 12 }} />

        {/* Title */}
        <h1 style={{
          fontFamily: '"Courier New", monospace',
          fontSize: '1rem', fontWeight: 700,
          color: NEON_ORANGE, letterSpacing: 3,
          textTransform: 'uppercase',
          textShadow: `0 0 20px rgba(255,106,26,0.4)`,
          marginBottom: 4,
        }}>
          Autonomous Claims Investigation
        </h1>
        <p style={{
          fontFamily: '"Courier New", monospace',
          fontSize: '0.6rem', color: 'rgba(255,106,26,0.4)',
          letterSpacing: 5, textTransform: 'uppercase',
        }}>
          & Fraud Intelligence
        </p>

        {/* CASE ACTIVE LED panel */}
        <div style={{
          marginTop: 20,
          background: 'rgba(0,0,0,0.7)',
          border: `1px solid ${NEON_ORANGE}`,
          borderRadius: 4,
          padding: '16px 24px',
          boxShadow: `0 0 20px rgba(255,106,26,0.15), inset 0 0 20px rgba(255,106,26,0.05)`,
          width: 'min(460px, 85vw)',
        }}>
          {/* Status bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12, padding: '0 4px',
          }}>
            <span style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.6rem', color: NEON_ORANGE,
              letterSpacing: 2, textTransform: 'uppercase',
            }}>
              ● CASE ACTIVE
            </span>
            <span style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.55rem', color: 'rgba(0,212,255,0.5)',
              letterSpacing: 1,
            }}>
              6 AGENTS ONLINE
            </span>
          </div>

          {/* Search input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="ENTER POLICY ID..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,106,26,0.2)',
                borderRadius: 2, padding: '8px 12px',
                color: '#fff', fontFamily: '"Courier New", monospace',
                fontSize: '0.8rem', letterSpacing: 2,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                background: NEON_ORANGE, border: 'none', borderRadius: 2,
                color: '#fff', fontFamily: '"Courier New", monospace',
                fontSize: '0.7rem', fontWeight: 700,
                letterSpacing: 2, padding: '8px 20px',
                cursor: loading ? 'wait' : 'pointer',
                textTransform: 'uppercase',
                boxShadow: `0 0 10px rgba(255,106,26,0.3)`,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'SCANNING...' : 'INVESTIGATE'}
            </button>
          </div>
          {error && (
            <p style={{
              color: '#f87171', fontFamily: '"Courier New", monospace',
              fontSize: '0.6rem', marginTop: 8, letterSpacing: 1,
            }}>{error}</p>
          )}
        </div>

        {/* Capabilities */}
        <div style={{
          display: 'flex', gap: 20, marginTop: 24,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {CAPABILITIES.map((cap, i) => (
            <div key={i} style={{ textAlign: 'center', maxWidth: 130 }}>
              <p style={{
                fontFamily: '"Courier New", monospace',
                fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)',
                letterSpacing: 1, textTransform: 'uppercase',
                marginBottom: 2,
              }}>{cap.title}</p>
              <p style={{
                fontFamily: '"Courier New", monospace',
                fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)',
              }}>{cap.desc}</p>
            </div>
          ))}
        </div>

        {/* Dashboard link */}
        {onGoToDashboard && (
          <button
            onClick={onGoToDashboard}
            style={{
              marginTop: 20,
              background: 'none',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 2,
              color: 'rgba(0,212,255,0.5)',
              fontFamily: '"Courier New", monospace',
              fontSize: '0.6rem', letterSpacing: 2,
              padding: '6px 16px', cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            → OPEN DASHBOARD
          </button>
        )}
      </div>

      {/* CSS keyframes for LED pulse */}
      <style>{`
        @keyframes pulse-led {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
