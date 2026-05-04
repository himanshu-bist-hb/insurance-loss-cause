/**
 * HOME PAGE — Concept 1: The Isometric Ops Center (v2)
 *
 * Inspired by multi-agent system illustrations: white/cream robots
 * on dark circular pedestals, holographic floating screens, a large
 * central orchestrator with glowing cylinder beam. Curved bezier
 * connections with comet-trail particles.
 */

import { useState, useEffect, useRef } from 'react'
import exlLogo from '../assets/images/exl_logo.png'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'
const BG = '#070b18'
const DEG = Math.PI / 180

const AGENTS = [
  { name: 'Loss Cause', color: '#10b981', angle: -90, status: 'Classifying loss patterns...', icon: '📉' },
  { name: 'ML Model', color: '#f97316', angle: -30, status: 'Fraud probability scoring...', icon: '🧠' },
  { name: 'Document', color: '#3b82f6', angle: 30, status: 'Scanning claim documents...', icon: '📄' },
  { name: 'Visual AI', color: '#8b5cf6', angle: 90, status: 'Analyzing image evidence...', icon: '👁' },
  { name: 'Web Search', color: '#06b6d4', angle: 150, status: 'Intelligence gathering...', icon: '🌐' },
  { name: 'Fraud Ring', color: '#f59e0b', angle: 210, status: 'Mapping entity networks...', icon: '🔗' },
]

function iso(wx: number, wy: number, wz: number, cx: number, cy: number) {
  return { x: cx + (wx - wy) * 0.866, y: cy + (wx + wy) * 0.5 - wz }
}

function hrgb(hex: string) {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

// ─── Isometric Scene (Canvas) ────────────────────────────────

export function IsometricScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const _ctx = canvas.getContext('2d')
    if (!_ctx) return
    const ctx = _ctx // non-null for nested functions

    let w = 0, h = 0, frame = 0

    interface Pt { x: number; y: number }
    interface Particle { connIdx: number; t: number; speed: number }
    interface FloatMsg { agentIdx: number; age: number; maxAge: number }

    let positions: Pt[] = []
    let agentWorld: { wx: number; wy: number; idx: number }[] = []
    let particles: Particle[] = []
    let floatMsgs: FloatMsg[] = []

    const RADIUS = 170, PLAT = 28, PLAT_H = 8, CTR = 42, CTR_H = 12
    const GRID_EXT = 380, GRID_SP = 40

    // Connections: [from, to] — idx 6 = Adjudicator center
    // Loss Cause(0) ↔ ML Model(1) ↔ Adjudicator(6)
    // All agents → Adjudicator
    // Adjacent agents can communicate (ring)
    const CONNECTIONS: [number, number][] = [
      // All agents → Adjudicator
      [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
      // Loss Cause ↔ ML Model (explicit cross-talk)
      [0, 1],
      // Adjacent agent ring
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      // Some cross connections for density
      [0, 3], [2, 5],
    ]

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const cvs = canvasRef.current
      if (!cvs) return
      w = cvs.clientWidth; h = cvs.clientHeight
      cvs.width = w * dpr; cvs.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles()
    }

    function initParticles() {
      particles = []
      for (let i = 0; i < CONNECTIONS.length; i++) {
        particles.push({ connIdx: i, t: Math.random(), speed: 0.002 + Math.random() * 0.003 })
      }
      for (let i = 0; i < 10; i++) {
        particles.push({ connIdx: Math.floor(Math.random() * CONNECTIONS.length), t: Math.random(), speed: 0.001 + Math.random() * 0.004 })
      }
      floatMsgs = []
    }

    function computePositions(cx: number, cy: number, sc: number) {
      agentWorld = AGENTS.map((a, _i) => {
        const rad = a.angle * DEG
        return { wx: RADIUS * Math.cos(rad) * sc, wy: RADIUS * Math.sin(rad) * sc, idx: _i }
      })
      positions = agentWorld.map(a => iso(a.wx, a.wy, PLAT_H * sc, cx, cy))
      positions[6] = iso(0, 0, CTR_H * sc, cx, cy)
    }

    // Rounded rect helper
    function rrect(x: number, y: number, w2: number, h2: number, r: number) {
      r = Math.min(r, w2 / 2, h2 / 2)
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.lineTo(x + w2 - r, y)
      ctx.arcTo(x + w2, y, x + w2, y + r, r)
      ctx.lineTo(x + w2, y + h2 - r)
      ctx.arcTo(x + w2, y + h2, x + w2 - r, y + h2, r)
      ctx.lineTo(x + r, y + h2)
      ctx.arcTo(x, y + h2, x, y + h2 - r, r)
      ctx.lineTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.closePath()
    }

    function connCtrl(f: Pt, t: Pt, curvature: number) {
      return { x: (f.x + t.x) / 2 + (f.y - t.y) * curvature, y: (f.y + t.y) / 2 + (t.x - f.x) * curvature }
    }

    function bezPt(f: Pt, c: Pt, t: Pt, p: number) {
      const inv = 1 - p
      return { x: inv * inv * f.x + 2 * inv * p * c.x + p * p * t.x, y: inv * inv * f.y + 2 * inv * p * c.y + p * p * t.y }
    }

    // ── Drawing ──

    function drawGrid(cx: number, cy: number, sc: number) {
      const ext = GRID_EXT * sc, sp = GRID_SP * sc
      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(100,150,255,0.018)'
      for (let v = -ext; v <= ext; v += sp) {
        let a = iso(v, -ext, 0, cx, cy), b = iso(v, ext, 0, cx, cy)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        a = iso(-ext, v, 0, cx, cy); b = iso(ext, v, 0, cx, cy)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
    }

    function drawConnections(sc: number) {
      for (const [fi, ti] of CONNECTIONS) {
        const f = positions[fi], t = positions[ti]
        if (!f || !t) continue
        const isHub = fi === 6 || ti === 6
        const agentIdx = fi === 6 ? ti : fi
        const fc = AGENTS[agentIdx]?.color || ORANGE
        const tc = ti === 6 ? ORANGE : (AGENTS[ti]?.color || ORANGE)
        const rgb = hrgb(fc)
        const curvature = isHub ? 0.1 : 0.2
        const ctrl = connCtrl(f, t, curvature)

        // Glow
        ctx.beginPath(); ctx.moveTo(f.x, f.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, t.x, t.y)
        ctx.strokeStyle = `rgba(${rgb},0.04)`; ctx.lineWidth = 8 * sc; ctx.stroke()

        // Line with gradient
        ctx.beginPath(); ctx.moveTo(f.x, f.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, t.x, t.y)
        const grad = ctx.createLinearGradient(f.x, f.y, t.x, t.y)
        grad.addColorStop(0, `rgba(${hrgb(fc)},0.2)`)
        grad.addColorStop(1, `rgba(${hrgb(tc)},0.2)`)
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5 * sc; ctx.stroke()

        // Junction dots at endpoints
        for (const p of [f, t]) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * sc, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb},0.25)`; ctx.fill()
        }
      }
    }

    // ── Platform: dark circular pedestal with glowing edge ──
    function drawPedestal(sx: number, sy: number, radius: number, color: string, sc: number, elevated: boolean) {
      const rgb = hrgb(color)
      const h = elevated ? 12 * sc : 6 * sc
      const rX = radius * sc
      const rY = rX * 0.38 // isometric squish

      // Side (cylinder wall)
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI) // bottom half of top ellipse
      ctx.lineTo(sx - rX, sy + h)
      ctx.ellipse(sx, sy + h, rX, rY, 0, Math.PI, 0, true) // bottom ellipse reversed
      ctx.closePath()
      ctx.fillStyle = '#0d1225'
      ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.15)`; ctx.lineWidth = 0.5; ctx.stroke()
      ctx.restore()

      // Top face
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2)
      const topGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rX)
      topGrad.addColorStop(0, '#1a2040')
      topGrad.addColorStop(0.7, '#111830')
      topGrad.addColorStop(1, '#0d1225')
      ctx.fillStyle = topGrad; ctx.fill()

      // Glowing edge ring
      ctx.beginPath()
      ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4; ctx.stroke()
      ctx.globalAlpha = 1

      // Outer glow
      ctx.beginPath()
      ctx.ellipse(sx, sy, rX + 3, rY + 1.5, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.08)`; ctx.lineWidth = 6; ctx.stroke()
      ctx.restore()

      // Floor glow beneath pedestal
      ctx.save()
      const floorGlow = ctx.createRadialGradient(sx, sy + h, 0, sx, sy + h, rX * 1.5)
      floorGlow.addColorStop(0, `rgba(${rgb},0.06)`)
      floorGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = floorGlow
      ctx.fillRect(sx - rX * 2, sy - rY * 2, rX * 4, rY * 4 + h * 2)
      ctx.restore()
    }

    // ── Agent Robot: white/cream body, dark visor, unique per agent ──
    function drawAgentBot(sx: number, sy: number, color: string, sc: number, agentIdx: number) {
      const rgb = hrgb(color)
      const s = sc * 1.15
      const bx = sx
      const baseY = sy - 8 * s

      // Robot dimensions
      const bodyW = 24 * s
      const bodyH = 30 * s
      const headR = 15 * s
      const bodyTop = baseY - bodyH
      const bodyLeft = bx - bodyW / 2

      // ── Body (white/cream capsule) ──
      // Shadow
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      rrect(bodyLeft + 2 * s, bodyTop + 2 * s, bodyW, bodyH, 8 * s)
      ctx.fill()
      ctx.restore()

      // Main body
      ctx.save()
      const bodyGrad = ctx.createLinearGradient(bodyLeft, bodyTop, bodyLeft + bodyW, baseY)
      bodyGrad.addColorStop(0, '#e8edf5')
      bodyGrad.addColorStop(0.4, '#f4f6fa')
      bodyGrad.addColorStop(0.6, '#dfe4ee')
      bodyGrad.addColorStop(1, '#c8ceda')
      ctx.fillStyle = bodyGrad
      rrect(bodyLeft, bodyTop, bodyW, bodyH, 8 * s)
      ctx.fill()
      // Colored accent line at bottom
      ctx.strokeStyle = color; ctx.lineWidth = 1.5 * s; ctx.stroke()
      ctx.restore()

      // ── Dome head ──
      ctx.save()
      const headCy = bodyTop + 1 * s
      const headGrad = ctx.createRadialGradient(bx - headR * 0.2, headCy - headR * 0.4, headR * 0.1, bx, headCy, headR)
      headGrad.addColorStop(0, '#f8fafe')
      headGrad.addColorStop(0.6, '#e0e5f0')
      headGrad.addColorStop(1, '#c0c8d8')
      ctx.fillStyle = headGrad
      ctx.beginPath()
      ctx.arc(bx, headCy, headR, Math.PI, 0)
      ctx.closePath()
      ctx.fill()

      // Head outline with agent color
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(bx, headCy, headR, Math.PI, 0); ctx.stroke()

      // Specular highlight on head
      ctx.beginPath()
      ctx.arc(bx - headR * 0.3, headCy - headR * 0.45, headR * 0.22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill()
      ctx.restore()

      // ── Ear nubs (small circles on sides of head) ──
      for (const side of [-1, 1]) {
        ctx.save()
        const earX = bx + side * (headR + 3 * s)
        const earY = headCy - 2 * s
        ctx.beginPath(); ctx.arc(earX, earY, 4 * s, 0, Math.PI * 2)
        ctx.fillStyle = '#d0d6e2'; ctx.fill()
        ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 0.8; ctx.stroke()
        // Small colored dot on ear
        ctx.beginPath(); ctx.arc(earX, earY, 1.5 * s, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
        ctx.restore()
      }

      // ── Antenna ──
      const antennaY = headCy - headR
      const antH = 10 * s
      ctx.save()
      ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 1.2 * s
      ctx.beginPath(); ctx.moveTo(bx, antennaY); ctx.lineTo(bx, antennaY - antH); ctx.stroke()
      const antPulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + agentIdx * 1.5)
      ctx.beginPath(); ctx.arc(bx, antennaY - antH, 3 * s, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10 * antPulse; ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()

      // ── Visor (dark band with glowing eyes) ──
      const visorY = bodyTop + bodyH * 0.15
      const visorH = bodyH * 0.28
      const visorW = bodyW * 0.88
      const visorLeft = bx - visorW / 2

      ctx.save()
      rrect(visorLeft, visorY, visorW, visorH, 4 * s)
      const visorGrad = ctx.createLinearGradient(visorLeft, visorY, visorLeft, visorY + visorH)
      visorGrad.addColorStop(0, '#0a0e1a')
      visorGrad.addColorStop(0.5, '#141c30')
      visorGrad.addColorStop(1, '#0c1020')
      ctx.fillStyle = visorGrad; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.2)`; ctx.lineWidth = 0.5; ctx.stroke()

      // Eyes
      const eyeSpacing = visorW * 0.32
      const eyeR = 3.5 * s
      const eyeY = visorY + visorH * 0.5
      const blink = Math.sin(frame * 0.035 + agentIdx * 1.1) > 0.96 ? 0.15 : 1

      for (const ex of [bx - eyeSpacing / 2, bx + eyeSpacing / 2]) {
        // Eye glow halo
        ctx.beginPath(); ctx.arc(ex, eyeY, eyeR * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},${(0.12 * blink).toFixed(2)})`; ctx.fill()
        // Eye core
        ctx.beginPath(); ctx.arc(ex, eyeY, eyeR * blink, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0
        // Pupil highlight
        ctx.beginPath(); ctx.arc(ex - eyeR * 0.25, eyeY - eyeR * 0.25, eyeR * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${(0.6 * blink).toFixed(2)})`; ctx.fill()
      }
      ctx.restore()

      // ── Chest plate with colored accent ──
      const chestY = visorY + visorH + 4 * s
      ctx.save()
      // Small colored rectangle (screen/indicator)
      rrect(bx - 6 * s, chestY, 12 * s, 6 * s, 2 * s)
      ctx.fillStyle = `rgba(${rgb},0.15)`; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.4)`; ctx.lineWidth = 0.5; ctx.stroke()
      // Pulsing dot
      const chestPulse = 0.4 + 0.6 * Math.sin(frame * 0.04 + agentIdx * 2)
      ctx.beginPath(); ctx.arc(bx, chestY + 3 * s, 1.5 * s, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 5 * chestPulse; ctx.fill(); ctx.shadowBlur = 0
      ctx.restore()

      // ── Floating holographic screen ──
      const screenSide = agentIdx % 2 === 0 ? 1 : -1
      const scrX = bx + screenSide * (bodyW / 2 + 14 * s)
      const scrY = bodyTop + bodyH * 0.1
      const scrW = 22 * s
      const scrH = 16 * s
      const scrFloat = Math.sin(frame * 0.02 + agentIdx * 1.3) * 2 * s

      ctx.save()
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(frame * 0.025 + agentIdx)
      rrect(scrX - scrW / 2, scrY + scrFloat, scrW, scrH, 2 * s)
      ctx.fillStyle = `rgba(${rgb},0.06)`; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.25)`; ctx.lineWidth = 0.5; ctx.stroke()

      // Mini content lines on screen
      for (let i = 0; i < 3; i++) {
        const lw = (scrW * 0.7 - i * 3 * s)
        ctx.fillStyle = `rgba(${rgb},0.15)`
        ctx.fillRect(scrX - lw / 2, scrY + scrFloat + 4 * s + i * 4 * s, lw, 1.5 * s)
      }

      // Connection line from robot to screen
      ctx.beginPath()
      ctx.moveTo(bx + screenSide * bodyW / 2, bodyTop + bodyH * 0.3)
      ctx.lineTo(scrX, scrY + scrFloat + scrH / 2)
      ctx.strokeStyle = `rgba(${rgb},0.15)`; ctx.lineWidth = 0.5; ctx.stroke()
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // ── Central Orchestrator / Adjudicator Bot (much larger) ──
    function drawOrchestratorBot(sx: number, sy: number, sc: number) {
      const rgb = hrgb(ORANGE)
      const s = sc * 2.0 // much bigger
      const bx = sx
      const baseY = sy - 10 * s

      const bodyW = 30 * s
      const bodyH = 38 * s
      const headR = 20 * s
      const bodyTop = baseY - bodyH
      const bodyLeft = bx - bodyW / 2

      // ── Holographic cylinder beam ──
      ctx.save()
      const cylR = 28 * s
      const cylRy = cylR * 0.35
      const cylTop = baseY - bodyH - headR - 15 * s
      const cylBot = baseY + 5 * s

      // Cylinder walls (translucent)
      ctx.globalAlpha = 0.06 + 0.02 * Math.sin(frame * 0.02)
      const cylGrad = ctx.createLinearGradient(bx, cylTop, bx, cylBot)
      cylGrad.addColorStop(0, 'rgba(77,208,225,0)')
      cylGrad.addColorStop(0.3, 'rgba(77,208,225,0.15)')
      cylGrad.addColorStop(0.7, 'rgba(77,208,225,0.15)')
      cylGrad.addColorStop(1, 'rgba(77,208,225,0)')
      ctx.fillStyle = cylGrad
      ctx.fillRect(bx - cylR, cylTop, cylR * 2, cylBot - cylTop)
      ctx.globalAlpha = 1

      // Top ring
      ctx.beginPath(); ctx.ellipse(bx, cylTop, cylR, cylRy, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(77,208,225,0.15)`; ctx.lineWidth = 1.5; ctx.stroke()
      // Bottom ring
      ctx.beginPath(); ctx.ellipse(bx, cylBot, cylR, cylRy, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(77,208,225,0.12)`; ctx.lineWidth = 1.5; ctx.stroke()

      // Rotating ring inside cylinder
      for (let r = 0; r < 3; r++) {
        const ringY = cylTop + (cylBot - cylTop) * (0.25 + r * 0.25)
        const ringR = cylR * (0.7 + r * 0.1)
        const ringRy = ringR * 0.35
        ctx.beginPath(); ctx.ellipse(bx, ringY, ringR, ringRy, 0, 0, Math.PI * 2)
        ctx.setLineDash([3, 5])
        ctx.lineDashOffset = -frame * 0.8 + r * 30
        ctx.strokeStyle = `rgba(77,208,225,${(0.08 + 0.03 * Math.sin(frame * 0.02 + r)).toFixed(3)})`
        ctx.lineWidth = 1; ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()

      // ── Body (larger white capsule) ──
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      rrect(bodyLeft + 3 * s, bodyTop + 3 * s, bodyW, bodyH, 10 * s)
      ctx.fill()
      ctx.restore()

      ctx.save()
      const bodyGrad = ctx.createLinearGradient(bodyLeft, bodyTop, bodyLeft + bodyW, baseY)
      bodyGrad.addColorStop(0, '#eaeef6')
      bodyGrad.addColorStop(0.35, '#f6f8fc')
      bodyGrad.addColorStop(0.65, '#e0e5f0')
      bodyGrad.addColorStop(1, '#c8ceda')
      ctx.fillStyle = bodyGrad
      rrect(bodyLeft, bodyTop, bodyW, bodyH, 10 * s)
      ctx.fill()
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 2 * s; ctx.stroke()
      ctx.restore()

      // ── Dome head (larger) ──
      ctx.save()
      const headCy = bodyTop + 2 * s
      const hGrad = ctx.createRadialGradient(bx - headR * 0.2, headCy - headR * 0.4, headR * 0.1, bx, headCy, headR)
      hGrad.addColorStop(0, '#f8fafe')
      hGrad.addColorStop(0.5, '#e2e7f2')
      hGrad.addColorStop(1, '#c4ccd8')
      ctx.fillStyle = hGrad
      ctx.beginPath(); ctx.arc(bx, headCy, headR, Math.PI, 0); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(bx, headCy, headR, Math.PI, 0); ctx.stroke()

      // Specular
      ctx.beginPath(); ctx.arc(bx - headR * 0.3, headCy - headR * 0.4, headR * 0.22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill()
      ctx.restore()

      // ── Ear nubs ──
      for (const side of [-1, 1]) {
        ctx.save()
        const earX = bx + side * (headR + 4 * s)
        const earY = headCy - 2 * s
        ctx.beginPath(); ctx.arc(earX, earY, 5 * s, 0, Math.PI * 2)
        ctx.fillStyle = '#d4dae6'; ctx.fill()
        ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath(); ctx.arc(earX, earY, 2 * s, 0, Math.PI * 2)
        ctx.fillStyle = ORANGE; ctx.fill()
        ctx.restore()
      }

      // ── Antenna (taller) ──
      const antennaY = headCy - headR
      const antH = 14 * s
      ctx.save()
      ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 1.5 * s
      ctx.beginPath(); ctx.moveTo(bx, antennaY); ctx.lineTo(bx, antennaY - antH); ctx.stroke()
      const antPulse = 0.5 + 0.5 * Math.sin(frame * 0.04)
      ctx.beginPath(); ctx.arc(bx, antennaY - antH, 4 * s, 0, Math.PI * 2)
      ctx.fillStyle = ORANGE; ctx.shadowColor = ORANGE; ctx.shadowBlur = 14 * antPulse; ctx.fill(); ctx.shadowBlur = 0
      ctx.restore()

      // ── Visor (single large eye — cyclopean) ──
      const visorY = bodyTop + bodyH * 0.15
      const visorH = bodyH * 0.26
      const visorW = bodyW * 0.88
      const visorLeft = bx - visorW / 2

      ctx.save()
      rrect(visorLeft, visorY, visorW, visorH, 5 * s)
      const vGrad = ctx.createLinearGradient(visorLeft, visorY, visorLeft, visorY + visorH)
      vGrad.addColorStop(0, '#080c18'); vGrad.addColorStop(0.5, '#101828'); vGrad.addColorStop(1, '#0a1020')
      ctx.fillStyle = vGrad; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 0.8; ctx.stroke()

      // Central eye
      const eyeY = visorY + visorH * 0.5
      const eyeR = 7 * s
      const eyePulse = 0.7 + 0.3 * Math.sin(frame * 0.03)

      ctx.beginPath(); ctx.arc(bx, eyeY, eyeR * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb},0.06)`; ctx.fill()
      ctx.beginPath(); ctx.arc(bx, eyeY, eyeR, 0, Math.PI * 2)
      ctx.fillStyle = ORANGE; ctx.shadowColor = ORANGE; ctx.shadowBlur = 12 * eyePulse; ctx.fill(); ctx.shadowBlur = 0
      // Inner iris
      ctx.beginPath(); ctx.arc(bx, eyeY, eyeR * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1

      // Scanning line
      const scanX = visorLeft + 3 + ((frame * 1.2) % (visorW - 6))
      ctx.beginPath(); ctx.moveTo(scanX, visorY + 2); ctx.lineTo(scanX, visorY + visorH - 2)
      ctx.strokeStyle = `rgba(${rgb},0.15)`; ctx.lineWidth = 1; ctx.stroke()
      ctx.restore()

      // ── Chest: "ADJUDICATOR" label ──
      ctx.save()
      const chestY = visorY + visorH + 5 * s
      rrect(bx - 14 * s, chestY, 28 * s, 10 * s, 3 * s)
      ctx.fillStyle = `rgba(${rgb},0.08)`; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.25)`; ctx.lineWidth = 0.5; ctx.stroke()
      ctx.font = `bold ${Math.max(5.5 * s, 7)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.fillStyle = `rgba(${rgb},0.5)`
      ctx.fillText('ADJUDICATOR', bx, chestY + 7 * s)
      ctx.restore()

      // ── Arms/shoulder nubs ──
      for (const side of [-1, 1]) {
        ctx.save()
        const armX = bodyLeft + (side === -1 ? -4 * s : bodyW + 4 * s)
        const armY = bodyTop + bodyH * 0.35
        // Shoulder
        ctx.beginPath(); ctx.arc(armX, armY, 5 * s, 0, Math.PI * 2)
        ctx.fillStyle = '#d8dee8'; ctx.fill()
        ctx.strokeStyle = `rgba(${rgb},0.2)`; ctx.lineWidth = 0.8; ctx.stroke()
        // Forearm nub
        ctx.beginPath(); ctx.arc(armX + side * 3 * s, armY + 8 * s, 3 * s, 0, Math.PI * 2)
        ctx.fillStyle = '#ccd2de'; ctx.fill()
        ctx.restore()
      }
    }

    function drawParticles() {
      for (const p of particles) {
        p.t += p.speed
        if (p.t >= 1) {
          p.t = 0; p.speed = 0.001 + Math.random() * 0.004
          p.connIdx = Math.floor(Math.random() * CONNECTIONS.length)
        }
        const [fi, ti] = CONNECTIONS[p.connIdx]
        const f = positions[fi], t = positions[ti]
        if (!f || !t) continue
        const agentIdx = fi === 6 ? ti : fi
        const color = AGENTS[agentIdx]?.color || ORANGE
        const rgb = hrgb(color)
        const isHub = fi === 6 || ti === 6
        const ctrl = connCtrl(f, t, isHub ? 0.1 : 0.2)

        for (let i = 8; i >= 0; i--) {
          const tt = Math.max(0, p.t - i * 0.012)
          const pt = bezPt(f, ctrl, t, tt)
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5 - i * 0.25, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb},${(0.6 - i * 0.06).toFixed(2)})`; ctx.fill()
        }
        const head = bezPt(f, ctrl, t, p.t)
        ctx.shadowColor = color; ctx.shadowBlur = 15
        ctx.beginPath(); ctx.arc(head.x, head.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},0.9)`; ctx.fill(); ctx.shadowBlur = 0
      }
    }

    function drawLabels(sc: number) {
      ctx.textAlign = 'center'
      for (const aw of agentWorld) {
        const a = AGENTS[aw.idx], sp = positions[aw.idx]
        const ly = sp.y + (PLAT + 20) * sc * 0.5
        ctx.font = `600 ${Math.max(10 * sc, 9)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `rgba(${hrgb(a.color)},0.75)`
        ctx.fillText(a.name.toUpperCase(), sp.x, ly)
        ctx.font = `${Math.max(7.5 * sc, 7)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `rgba(${hrgb(a.color)},0.3)`
        ctx.fillText('● ONLINE', sp.x, ly + 11 * sc)
      }
      // Orchestrator label
      ctx.font = `bold ${Math.max(11 * sc, 9)}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = `rgba(${hrgb(ORANGE)},0.65)`
      ctx.fillText('ORCHESTRATOR', positions[6].x, positions[6].y + (CTR + 22) * sc * 0.5)
    }

    function drawFloatingMsgs(sc: number) {
      if (frame % 150 === 0 && floatMsgs.length < 3) {
        floatMsgs.push({ agentIdx: Math.floor(Math.random() * 6), age: 0, maxAge: 200 })
      }
      for (const m of floatMsgs) {
        m.age++
        const progress = m.age / m.maxAge
        const opacity = progress < 0.1 ? progress * 10 : progress > 0.7 ? (1 - progress) / 0.3 : 1
        const yOff = -progress * 35 * sc
        const sp = positions[m.agentIdx]
        if (!sp) continue
        const a = AGENTS[m.agentIdx]
        ctx.font = `${Math.max(8 * sc, 7)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(${hrgb(a.color)},${(opacity * 0.3).toFixed(2)})`
        ctx.fillText(a.status, sp.x, sp.y - (PLAT + 50) * sc * 0.5 + yOff)
      }
      floatMsgs = floatMsgs.filter(m => m.age < m.maxAge)
    }

    // ── Main draw loop ──
    function draw() {
      frame++
      const sc = Math.min(w, h) / 750
      const px = (mouseRef.current.x - 0.5) * 20 * sc
      const py = (mouseRef.current.y - 0.5) * 12 * sc
      const cx = w / 2 + px, cy = h * 0.48 + py

      computePositions(cx, cy, sc)

      // Background
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h)
      const vg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7)
      vg.addColorStop(0, 'rgba(15,20,45,0.3)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h)
      const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300 * sc)
      ag.addColorStop(0, 'rgba(77,208,225,0.025)'); ag.addColorStop(1, 'transparent')
      ctx.fillStyle = ag; ctx.fillRect(0, 0, w, h)

      drawGrid(cx, cy, sc)
      drawConnections(sc)

      // Depth-sorted elements
      type El = { type: 'agent'; idx: number; sy: number } | { type: 'center'; sy: number }
      const els: El[] = agentWorld.map(a => ({ type: 'agent' as const, idx: a.idx, sy: positions[a.idx].y }))
      els.push({ type: 'center', sy: positions[6].y })
      els.sort((a, b) => a.sy - b.sy)

      for (const el of els) {
        if (el.type === 'center') {
          drawPedestal(positions[6].x, positions[6].y, CTR, ORANGE, sc, true)
          drawOrchestratorBot(positions[6].x, positions[6].y, sc)
        } else {
          const sp = positions[el.idx]
          drawPedestal(sp.x, sp.y, PLAT, AGENTS[el.idx].color, sc, false)
          drawAgentBot(sp.x, sp.y, AGENTS[el.idx].color, sc, el.idx)
        }
      }

      drawParticles()
      drawLabels(sc)
      drawFloatingMsgs(sc)

      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX / w, y: e.clientY / h } }
    window.addEventListener('mousemove', onMouse)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />
}

// ─── Main Component ──────────────────────────────────────────

interface HomePageProps {
  onPolicySelected: (policyId: string, policyData: any) => void
  onGoToDashboard?: () => void
}

export default function HomePage({ onPolicySelected, onGoToDashboard }: HomePageProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/policies/search?q=${query}`)
          if (res.ok) { setSuggestions(await res.json()); setShowSuggestions(true) }
        } catch { /* ignore */ }
      } else { setSuggestions([]); setShowSuggestions(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPolicy = async (policyId: string) => {
    setQuery(policyId); setSuggestions([]); setShowSuggestions(false); setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/policies/${policyId}`)
      if (res.ok) onPolicySelected(policyId, await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div style={{
      height: '100vh', background: BG, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      <style>{`.hero-search::placeholder { color: rgba(255,255,255,0.35); }`}</style>

      <IsometricScene />

      {onGoToDashboard && (
        <button onClick={onGoToDashboard} style={{
          position: 'absolute', top: 20, right: 24, zIndex: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer',
          fontSize: '12px', fontWeight: 500, fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          transition: 'all 0.2s', backdropFilter: 'blur(10px)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(250,78,10,0.1)'; e.currentTarget.style.borderColor = 'rgba(250,78,10,0.3)'; e.currentTarget.style.color = '#f97316' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8' }}
        >
          Dashboard →
        </button>
      )}

      {/* Top: Logo + Title */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: '28px' }}>
        <img src={exlLogo} alt="EXL" style={{ height: '56px', display: 'block', margin: '0 auto 14px' }} />
        <h1 style={{
          fontSize: '32px', fontWeight: 300, color: '#fff', lineHeight: 1.15, marginBottom: '6px',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', letterSpacing: '-0.5px',
        }}>
          Autonomous Claims Investigation &<br />
          <span style={{ fontWeight: 600, color: ORANGE }}>Fraud Intelligence</span>
        </h1>
        <p style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0,
          letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 500,
        }}>
          Multi-Agent AI Command Center
        </p>
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom: Search + Footer */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingBottom: '24px', gap: '16px',
      }}>
        <div ref={searchRef} style={{ maxWidth: '480px', width: '90%', position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '4px 4px 4px 16px',
            border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input className="hero-search" type="text" value={query}
              onChange={e => setQuery(e.target.value)} placeholder="Search policy number..."
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: '14px',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#fff', background: 'transparent',
              }}
            />
            <button onClick={() => { if (suggestions.length) selectPolicy(suggestions[0]) }}
              disabled={loading || !suggestions.length}
              style={{
                padding: '9px 22px', background: ORANGE, color: '#fff', border: 'none',
                borderRadius: '9px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              }}>
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#1e293b', borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', zIndex: 20,
              maxHeight: '240px', overflowY: 'auto',
            }}>
              {suggestions.map(id => (
                <div key={id} onClick={() => selectPolicy(id)} style={{
                  padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s',
                  fontSize: '13px', color: '#e2e8f0',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(250,78,10,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['7 AI Agents', 'Real-Time Streaming', 'Fraud Ring Detection', 'ML Scoring', 'Auto Verdicts'].map(label => (
            <span key={label} style={{
              fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.3)',
              padding: '5px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)',
            }}>{label}</span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)' }}>Powered by</span>
          <img src={exlLogo} alt="EXL" style={{ height: '14px', filter: 'brightness(0) invert(1)', opacity: 0.15 }} />
        </div>
      </div>
    </div>
  )
}
