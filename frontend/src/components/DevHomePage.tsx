/**
 * Dev Homepage — Complete Redesign
 * Route: /dev-homepage
 *
 * Split layout: left branding, right 2-persona login cards.
 * Canvas background: 6 themed holographic agent orbs + orchestrator,
 * connected by bezier curves with comet-trail particles.
 *
 * Each agent has a unique visual theme (not generic robots):
 *   Loss Cause  → flame + bar chart
 *   ML Model    → neural dots + gear
 *   Document    → page + magnifier
 *   Visual AI   → camera lens + image frame
 *   Web Search  → globe + browser
 *   Fraud Ring  → network graph + alert
 */

import { useState, useEffect, useRef } from 'react'
import exlLogo from '../assets/images/exl_logo.png'
import { API_BASE_URL } from '../config'

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */
const ORANGE = '#fa4e0a'
const CYAN   = '#06b6d4'
const PURPLE = '#8b5cf6'
const BG     = '#050810'
const DEG    = Math.PI / 180

const AGENTS = [
  { name: 'Loss Cause',  color: '#10b981', angle: -90  },
  { name: 'ML Model',    color: '#f97316', angle: -30  },
  { name: 'Document',    color: '#3b82f6', angle:  30  },
  { name: 'Visual AI',   color: '#8b5cf6', angle:  90  },
  { name: 'Web Search',  color: '#06b6d4', angle: 150  },
  { name: 'Fraud Ring',  color: '#f59e0b', angle: 210  },
]

const CONNECTIONS: [number, number][] = [
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],
  [0,3],[2,5],
]

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */
function hrgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`
}

function iso(wx: number, wy: number, wz: number, cx: number, cy: number) {
  return { x: cx + (wx - wy) * 0.866, y: cy + (wx + wy) * 0.5 - wz }
}

interface Pt { x: number; y: number }

function connCtrl(f: Pt, t: Pt, curv: number): Pt {
  return { x: (f.x+t.x)/2 + (f.y-t.y)*curv, y: (f.y+t.y)/2 + (t.x-f.x)*curv }
}

function bezPt(f: Pt, c: Pt, t: Pt, p: number): Pt {
  const inv = 1-p
  return { x: inv*inv*f.x + 2*inv*p*c.x + p*p*t.x, y: inv*inv*f.y + 2*inv*p*c.y + p*p*t.y }
}

/* ═══════════════════════════════════════════════════════
   CANVAS: THEMED AGENT SCENE
   ═══════════════════════════════════════════════════════ */
function AgentScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef  = useRef({ x: 0.5, y: 0.5 })
  const rafRef    = useRef(0)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const _ctx = cvs.getContext('2d')
    if (!_ctx) return
    const ctx = _ctx

    let w = 0, h = 0, frame = 0
    const RADIUS = 150, PLAT = 28, PLAT_H = 8, CTR = 42, CTR_H = 12
    const GRID_EXT = 380, GRID_SP = 40

    interface Particle { ci: number; t: number; sp: number }
    let positions: Pt[] = []
    let agentWorld: { wx: number; wy: number; idx: number }[] = []
    let particles: Particle[] = []

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const el = canvasRef.current
      if (!el) return
      w = el.clientWidth; h = el.clientHeight
      el.width = w * dpr; el.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles()
    }

    function initParticles() {
      particles = []
      for (let i = 0; i < CONNECTIONS.length; i++)
        particles.push({ ci: i, t: Math.random(), sp: 0.002 + Math.random() * 0.003 })
      for (let i = 0; i < 8; i++)
        particles.push({ ci: Math.floor(Math.random() * CONNECTIONS.length), t: Math.random(), sp: 0.001 + Math.random() * 0.004 })
    }

    function computePositions(cx: number, cy: number, sc: number) {
      agentWorld = AGENTS.map((a, i) => {
        const rad = a.angle * DEG
        return { wx: RADIUS * Math.cos(rad) * sc, wy: RADIUS * Math.sin(rad) * sc, idx: i }
      })
      positions = agentWorld.map(a => iso(a.wx, a.wy, PLAT_H * sc, cx, cy))
      positions[6] = iso(0, 0, CTR_H * sc, cx, cy)
    }

    /* ── Grid ── */
    function drawGrid(cx: number, cy: number, sc: number) {
      const ext = GRID_EXT * sc, sp = GRID_SP * sc
      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(80,130,220,0.015)'
      for (let v = -ext; v <= ext; v += sp) {
        let a = iso(v, -ext, 0, cx, cy), b = iso(v, ext, 0, cx, cy)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        a = iso(-ext, v, 0, cx, cy); b = iso(ext, v, 0, cx, cy)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
    }

    /* ── Connections ── */
    function drawConnections(sc: number) {
      for (const [fi, ti] of CONNECTIONS) {
        const f = positions[fi], t = positions[ti]
        if (!f || !t) continue
        const isHub = fi === 6 || ti === 6
        const ai = fi === 6 ? ti : fi
        const fc = AGENTS[ai]?.color || ORANGE
        const tc = ti === 6 ? ORANGE : (AGENTS[ti]?.color || ORANGE)
        const rgb = hrgb(fc)
        const ctrl = connCtrl(f, t, isHub ? 0.1 : 0.2)

        ctx.beginPath(); ctx.moveTo(f.x, f.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, t.x, t.y)
        ctx.strokeStyle = `rgba(${rgb},0.035)`; ctx.lineWidth = 6 * sc; ctx.stroke()

        ctx.beginPath(); ctx.moveTo(f.x, f.y)
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, t.x, t.y)
        const grad = ctx.createLinearGradient(f.x, f.y, t.x, t.y)
        grad.addColorStop(0, `rgba(${hrgb(fc)},0.18)`)
        grad.addColorStop(1, `rgba(${hrgb(tc)},0.18)`)
        ctx.strokeStyle = grad; ctx.lineWidth = 1.2 * sc; ctx.stroke()

        for (const p of [f, t]) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 2 * sc, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb},0.2)`; ctx.fill()
        }
      }
    }

    /* ── Pedestal ── */
    function drawPedestal(sx: number, sy: number, radius: number, color: string, sc: number, elevated: boolean) {
      const rgb = hrgb(color)
      const pH = elevated ? 12 * sc : 6 * sc
      const rX = radius * sc, rY = rX * 0.38

      ctx.save()
      ctx.beginPath()
      ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI)
      ctx.lineTo(sx - rX, sy + pH)
      ctx.ellipse(sx, sy + pH, rX, rY, 0, Math.PI, 0, true)
      ctx.closePath()
      ctx.fillStyle = '#0c1020'; ctx.fill()
      ctx.strokeStyle = `rgba(${rgb},0.12)`; ctx.lineWidth = 0.5; ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.beginPath(); ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2)
      const tg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rX)
      tg.addColorStop(0, '#181e35'); tg.addColorStop(0.7, '#10152a'); tg.addColorStop(1, '#0c1020')
      ctx.fillStyle = tg; ctx.fill()

      ctx.beginPath(); ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1

      ctx.beginPath(); ctx.ellipse(sx, sy, rX + 3, rY + 1.5, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.06)`; ctx.lineWidth = 6; ctx.stroke()
      ctx.restore()

      ctx.save()
      const fg = ctx.createRadialGradient(sx, sy + pH, 0, sx, sy + pH, rX * 1.5)
      fg.addColorStop(0, `rgba(${rgb},0.05)`); fg.addColorStop(1, 'transparent')
      ctx.fillStyle = fg; ctx.fillRect(sx - rX * 2, sy - rY * 2, rX * 4, rY * 4 + pH * 2)
      ctx.restore()
    }

    /* ── Light Beam (platform → orb) ── */
    function drawBeam(sx: number, sy: number, orbY: number, color: string, sc: number) {
      const rgb = hrgb(color)
      const bw = 4 * sc
      const g = ctx.createLinearGradient(sx, orbY, sx, sy)
      g.addColorStop(0, `rgba(${rgb},0.12)`)
      g.addColorStop(0.5, `rgba(${rgb},0.04)`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(sx - bw / 2, orbY, bw, sy - orbY)
    }

    /* ── 3D Glass Sphere ── */
    function drawSphere(x: number, y: number, r: number, color: string, rgb: string, sc: number) {
      // Outer glow halo
      ctx.save()
      const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2)
      halo.addColorStop(0, `rgba(${rgb},0.08)`); halo.addColorStop(1, 'transparent')
      ctx.fillStyle = halo
      ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5)
      ctx.restore()

      // Main sphere body (3D radial gradient)
      ctx.save()
      const sg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x + r * 0.1, y + r * 0.1, r)
      sg.addColorStop(0, `rgba(${rgb},0.55)`)
      sg.addColorStop(0.25, `rgba(${rgb},0.35)`)
      sg.addColorStop(0.55, `rgba(${rgb},0.15)`)
      sg.addColorStop(0.8, 'rgba(15,20,40,0.5)')
      sg.addColorStop(1, 'rgba(8,12,25,0.7)')
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = sg; ctx.fill()

      // Edge ring
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 1.2 * sc; ctx.stroke()

      // Glass inner glow
      const ig = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 0.8)
      ig.addColorStop(0, `rgba(${rgb},0.08)`); ig.addColorStop(1, 'transparent')
      ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2)
      ctx.fillStyle = ig; ctx.fill()

      // Specular highlight (large diffuse)
      ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill()

      // Specular highlight (small bright)
      ctx.beginPath(); ctx.arc(x - r * 0.18, y - r * 0.22, r * 0.07, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()

      // Bottom rim catch light
      ctx.beginPath()
      ctx.arc(x + r * 0.15, y + r * 0.25, r * 0.12, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb},0.12)`; ctx.fill()
      ctx.restore()

      // Equatorial ring (dashed, rotating)
      ctx.save()
      const ringRx = r * 1.15, ringRy = r * 0.3
      ctx.beginPath(); ctx.ellipse(x, y, ringRx, ringRy, 0, 0, Math.PI * 2)
      ctx.setLineDash([3 * sc, 4 * sc])
      ctx.lineDashOffset = -frame * 0.6
      ctx.strokeStyle = `rgba(${rgb},0.2)`; ctx.lineWidth = 0.8 * sc; ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    /* ═══ THEMED ICON DRAWING ═══ */

    function orbitPos(cx: number, cy: number, idx: number, total: number, orbR: number, speed: number) {
      const angle = (idx / total) * Math.PI * 2 + frame * speed
      const bob = Math.sin(frame * 0.025 + idx * 2.1) * 3
      return { x: cx + orbR * Math.cos(angle), y: cy + orbR * Math.sin(angle) * 0.4 + bob }
    }

    // ── Loss Cause: flame + bar chart ──
    function drawLossCauseIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Flame
      const f = orbitPos(cx, cy, 0, 2, orbR, 0.008)
      const fs = 8 * sc
      ctx.save(); ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.moveTo(f.x, f.y + fs)
      ctx.quadraticCurveTo(f.x - fs * 0.7, f.y, f.x, f.y - fs)
      ctx.quadraticCurveTo(f.x + fs * 0.7, f.y, f.x, f.y + fs)
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill()
      ctx.shadowBlur = 0; ctx.restore()

      // Bar chart
      const b = orbitPos(cx, cy, 1, 2, orbR, 0.008)
      const bs = 5 * sc
      ctx.save(); ctx.globalAlpha = 0.55
      const heights = [0.5, 0.9, 0.65]
      for (let i = 0; i < 3; i++) {
        const bh = bs * 2 * heights[i]
        ctx.fillStyle = `rgba(${rgb},${0.5 + i * 0.15})`
        ctx.fillRect(b.x - bs * 1.2 + i * bs * 0.9, b.y + bs - bh, bs * 0.6, bh)
      }
      ctx.restore()
    }

    // ── ML Model: neural dots + gear ──
    function drawMLModelIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Neural net (5 connected dots)
      const n = orbitPos(cx, cy, 0, 2, orbR, 0.007)
      const ns = 6 * sc
      ctx.save(); ctx.globalAlpha = 0.55
      const nodes = [
        { x: n.x - ns, y: n.y - ns * 0.5 },
        { x: n.x + ns, y: n.y - ns * 0.5 },
        { x: n.x, y: n.y + ns * 0.8 },
        { x: n.x - ns * 0.5, y: n.y + ns * 0.2 },
        { x: n.x + ns * 0.5, y: n.y + ns * 0.2 },
      ]
      // Edges
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 0.6 * sc
      const edges = [[0,3],[0,4],[1,3],[1,4],[3,2],[4,2]]
      for (const [a, b2] of edges) {
        ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b2].x, nodes[b2].y); ctx.stroke()
      }
      // Nodes
      for (const nd of nodes) {
        ctx.beginPath(); ctx.arc(nd.x, nd.y, 1.5 * sc, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
      }
      ctx.restore()

      // Gear (octagon)
      const g = orbitPos(cx, cy, 1, 2, orbR, 0.007)
      const gs = 6 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 8
        const r2 = i % 2 === 0 ? gs : gs * 0.7
        const px = g.x + r2 * Math.cos(a + frame * 0.01)
        const py = g.y + r2 * Math.sin(a + frame * 0.01)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = color; ctx.lineWidth = 0.8 * sc; ctx.stroke()
      ctx.beginPath(); ctx.arc(g.x, g.y, gs * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      ctx.restore()
    }

    // ── Document: page + magnifier ──
    function drawDocumentIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Document page
      const d = orbitPos(cx, cy, 0, 2, orbR, 0.009)
      const ds = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.55
      ctx.fillStyle = `rgba(${rgb},0.25)`
      ctx.fillRect(d.x - ds * 0.5, d.y - ds * 0.7, ds, ds * 1.4)
      // Fold corner
      ctx.fillStyle = `rgba(${rgb},0.45)`
      ctx.beginPath()
      ctx.moveTo(d.x + ds * 0.2, d.y - ds * 0.7)
      ctx.lineTo(d.x + ds * 0.5, d.y - ds * 0.4)
      ctx.lineTo(d.x + ds * 0.2, d.y - ds * 0.4)
      ctx.fill()
      // Text lines
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(${rgb},0.3)`
        ctx.fillRect(d.x - ds * 0.3, d.y - ds * 0.15 + i * ds * 0.3, ds * 0.6 - i * ds * 0.1, ds * 0.08)
      }
      // Border
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 0.5 * sc
      ctx.strokeRect(d.x - ds * 0.5, d.y - ds * 0.7, ds, ds * 1.4)
      ctx.restore()

      // Magnifying glass
      const m = orbitPos(cx, cy, 1, 2, orbR, 0.009)
      const ms = 5 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.arc(m.x, m.y - ms * 0.2, ms, 0, Math.PI * 2)
      ctx.strokeStyle = color; ctx.lineWidth = 1 * sc; ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(m.x + ms * 0.7, m.y + ms * 0.5)
      ctx.lineTo(m.x + ms * 1.4, m.y + ms * 1.2)
      ctx.strokeStyle = color; ctx.lineWidth = 1.2 * sc; ctx.stroke()
      ctx.restore()
    }

    // ── Visual AI: camera lens + image frame ──
    function drawVisualAIIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Camera lens (concentric circles)
      const l = orbitPos(cx, cy, 0, 2, orbR, 0.006)
      const ls = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      for (let i = 3; i >= 0; i--) {
        ctx.beginPath(); ctx.arc(l.x, l.y, ls * (0.3 + i * 0.2), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${rgb},${0.15 + i * 0.08})`; ctx.lineWidth = 0.6 * sc; ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(l.x, l.y, ls * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      ctx.restore()

      // Image frame with mountain
      const im = orbitPos(cx, cy, 1, 2, orbR, 0.006)
      const is2 = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 0.6 * sc
      ctx.strokeRect(im.x - is2, im.y - is2 * 0.7, is2 * 2, is2 * 1.4)
      // Mountain shape inside
      ctx.beginPath()
      ctx.moveTo(im.x - is2 * 0.8, im.y + is2 * 0.5)
      ctx.lineTo(im.x - is2 * 0.2, im.y - is2 * 0.1)
      ctx.lineTo(im.x + is2 * 0.1, im.y + is2 * 0.2)
      ctx.lineTo(im.x + is2 * 0.4, im.y - is2 * 0.2)
      ctx.lineTo(im.x + is2 * 0.8, im.y + is2 * 0.5)
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.stroke()
      // Sun dot
      ctx.beginPath(); ctx.arc(im.x + is2 * 0.5, im.y - is2 * 0.35, is2 * 0.12, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb},0.4)`; ctx.fill()
      ctx.restore()
    }

    // ── Web Search: globe + browser ──
    function drawWebSearchIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Globe
      const gl = orbitPos(cx, cy, 0, 2, orbR, 0.008)
      const gs = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.beginPath(); ctx.arc(gl.x, gl.y, gs, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 0.7 * sc; ctx.stroke()
      // Equator
      ctx.beginPath(); ctx.ellipse(gl.x, gl.y, gs, gs * 0.35, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.25)`; ctx.lineWidth = 0.5 * sc; ctx.stroke()
      // Meridian
      ctx.beginPath(); ctx.ellipse(gl.x, gl.y, gs * 0.35, gs, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.25)`; ctx.lineWidth = 0.5 * sc; ctx.stroke()
      // Horizontal line
      ctx.beginPath(); ctx.moveTo(gl.x - gs, gl.y); ctx.lineTo(gl.x + gs, gl.y)
      ctx.strokeStyle = `rgba(${rgb},0.2)`; ctx.lineWidth = 0.4 * sc; ctx.stroke()
      ctx.restore()

      // Browser window
      const bw = orbitPos(cx, cy, 1, 2, orbR, 0.008)
      const bs = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 0.6 * sc
      ctx.strokeRect(bw.x - bs, bw.y - bs * 0.6, bs * 2, bs * 1.4)
      // Toolbar
      ctx.beginPath()
      ctx.moveTo(bw.x - bs, bw.y - bs * 0.25)
      ctx.lineTo(bw.x + bs, bw.y - bs * 0.25)
      ctx.stroke()
      // Tab dots
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(bw.x - bs * 0.7 + i * bs * 0.3, bw.y - bs * 0.43, 1 * sc, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? `rgba(${rgb},0.5)` : `rgba(${rgb},0.25)`; ctx.fill()
      }
      ctx.restore()
    }

    // ── Fraud Ring: network graph + alert triangle ──
    function drawFraudRingIcons(cx: number, cy: number, sc: number, color: string) {
      const rgb = hrgb(color), orbR = 32 * sc

      // Network graph
      const ng = orbitPos(cx, cy, 0, 2, orbR, 0.007)
      const ns = 7 * sc
      ctx.save(); ctx.globalAlpha = 0.55
      const gnodes = [
        { x: ng.x, y: ng.y - ns },
        { x: ng.x - ns * 0.9, y: ng.y + ns * 0.3 },
        { x: ng.x + ns * 0.9, y: ng.y + ns * 0.3 },
        { x: ng.x, y: ng.y + ns * 0.8 },
      ]
      const gedges = [[0,1],[0,2],[1,2],[1,3],[2,3]]
      ctx.strokeStyle = `rgba(${rgb},0.3)`; ctx.lineWidth = 0.6 * sc
      for (const [a, b2] of gedges) {
        ctx.beginPath(); ctx.moveTo(gnodes[a].x, gnodes[a].y); ctx.lineTo(gnodes[b2].x, gnodes[b2].y); ctx.stroke()
      }
      for (let i = 0; i < gnodes.length; i++) {
        ctx.beginPath(); ctx.arc(gnodes[i].x, gnodes[i].y, 1.8 * sc, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#ef4444' : color; ctx.fill()
      }
      ctx.restore()

      // Alert triangle
      const at = orbitPos(cx, cy, 1, 2, orbR, 0.007)
      const as2 = 6 * sc
      ctx.save(); ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(at.x, at.y - as2)
      ctx.lineTo(at.x - as2 * 0.85, at.y + as2 * 0.6)
      ctx.lineTo(at.x + as2 * 0.85, at.y + as2 * 0.6)
      ctx.closePath()
      ctx.strokeStyle = color; ctx.lineWidth = 0.8 * sc; ctx.stroke()
      // Exclamation
      ctx.fillStyle = color
      ctx.fillRect(at.x - 0.5 * sc, at.y - as2 * 0.25, 1 * sc, as2 * 0.45)
      ctx.beginPath(); ctx.arc(at.x, at.y + as2 * 0.35, 0.8 * sc, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    const themedDrawers = [
      drawLossCauseIcons, drawMLModelIcons, drawDocumentIcons,
      drawVisualAIIcons, drawWebSearchIcons, drawFraudRingIcons,
    ]

    /* ── Orchestrator (center, larger) ── */
    function drawOrchestrator(sx: number, sy: number, sc: number) {
      const r = 26 * sc
      const orbY = sy - 42 * sc

      drawBeam(sx, sy, orbY - r, ORANGE, sc)

      // Holographic cylinder
      ctx.save()
      const cylR = 30 * sc, cylRy = cylR * 0.35
      const cylTop = orbY - r - 12 * sc, cylBot = sy + 5 * sc
      ctx.globalAlpha = 0.05 + 0.02 * Math.sin(frame * 0.02)
      const cg = ctx.createLinearGradient(sx, cylTop, sx, cylBot)
      cg.addColorStop(0, 'rgba(77,208,225,0)'); cg.addColorStop(0.3, 'rgba(77,208,225,0.12)')
      cg.addColorStop(0.7, 'rgba(77,208,225,0.12)'); cg.addColorStop(1, 'rgba(77,208,225,0)')
      ctx.fillStyle = cg; ctx.fillRect(sx - cylR, cylTop, cylR * 2, cylBot - cylTop)
      ctx.globalAlpha = 1

      ctx.beginPath(); ctx.ellipse(sx, cylTop, cylR, cylRy, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(77,208,225,0.12)'; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.beginPath(); ctx.ellipse(sx, cylBot, cylR, cylRy, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(77,208,225,0.1)'; ctx.lineWidth = 1.2; ctx.stroke()

      for (let i = 0; i < 3; i++) {
        const ry = cylTop + (cylBot - cylTop) * (0.25 + i * 0.25)
        const rr = cylR * (0.65 + i * 0.12), rry = rr * 0.35
        ctx.beginPath(); ctx.ellipse(sx, ry, rr, rry, 0, 0, Math.PI * 2)
        ctx.setLineDash([3, 5]); ctx.lineDashOffset = -frame * 0.8 + i * 30
        ctx.strokeStyle = `rgba(77,208,225,${(0.06 + 0.03 * Math.sin(frame * 0.02 + i)).toFixed(3)})`
        ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([])
      }
      ctx.restore()

      // Large multi-color sphere
      const rgb = hrgb(ORANGE)
      ctx.save()
      const halo = ctx.createRadialGradient(sx, orbY, r * 0.5, sx, orbY, r * 2.5)
      halo.addColorStop(0, `rgba(${rgb},0.1)`); halo.addColorStop(1, 'transparent')
      ctx.fillStyle = halo; ctx.fillRect(sx - r * 3, orbY - r * 3, r * 6, r * 6)
      ctx.restore()

      ctx.save()
      const sg = ctx.createRadialGradient(sx - r * 0.3, orbY - r * 0.3, r * 0.05, sx + r * 0.1, orbY + r * 0.1, r)
      sg.addColorStop(0, 'rgba(250,120,40,0.6)')
      sg.addColorStop(0.2, 'rgba(250,78,10,0.4)')
      sg.addColorStop(0.45, 'rgba(139,92,246,0.2)')
      sg.addColorStop(0.7, 'rgba(6,182,212,0.12)')
      sg.addColorStop(1, 'rgba(8,12,25,0.7)')
      ctx.beginPath(); ctx.arc(sx, orbY, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill()

      ctx.beginPath(); ctx.arc(sx, orbY, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 1.5 * sc; ctx.stroke()

      ctx.beginPath(); ctx.arc(sx - r * 0.28, orbY - r * 0.32, r * 0.2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill()
      ctx.beginPath(); ctx.arc(sx - r * 0.15, orbY - r * 0.2, r * 0.06, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
      ctx.restore()

      // Dual orbital rings
      for (let i = 0; i < 2; i++) {
        ctx.save()
        const rr = r * (1.2 + i * 0.25), ry = rr * (0.28 + i * 0.06)
        ctx.beginPath(); ctx.ellipse(sx, orbY, rr, ry, 0, 0, Math.PI * 2)
        ctx.setLineDash([2 * sc, 3 * sc]); ctx.lineDashOffset = -frame * (0.5 + i * 0.3) * (i % 2 ? -1 : 1)
        ctx.strokeStyle = `rgba(${rgb},${0.18 - i * 0.05})`; ctx.lineWidth = 0.7 * sc; ctx.stroke()
        ctx.setLineDash([]); ctx.restore()
      }

      // "ADJUDICATOR" label on sphere
      ctx.save()
      ctx.font = `bold ${Math.max(6 * sc, 7)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.fillStyle = `rgba(${rgb},0.5)`
      ctx.fillText('ADJUDICATOR', sx, orbY + r + 12 * sc)
      ctx.restore()
    }

    /* ── Particles ── */
    function drawParticles() {
      for (const p of particles) {
        p.t += p.sp
        if (p.t >= 1) { p.t = 0; p.sp = 0.001 + Math.random() * 0.004; p.ci = Math.floor(Math.random() * CONNECTIONS.length) }
        const [fi, ti] = CONNECTIONS[p.ci]
        const f = positions[fi], t = positions[ti]
        if (!f || !t) continue
        const ai = fi === 6 ? ti : fi
        const color = AGENTS[ai]?.color || ORANGE
        const rgb = hrgb(color)
        const ctrl = connCtrl(f, t, (fi === 6 || ti === 6) ? 0.1 : 0.2)

        for (let i = 7; i >= 0; i--) {
          const tt = Math.max(0, p.t - i * 0.013)
          const pt = bezPt(f, ctrl, t, tt)
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.2 - i * 0.25, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb},${(0.5 - i * 0.06).toFixed(2)})`; ctx.fill()
        }
        const head = bezPt(f, ctrl, t, p.t)
        ctx.shadowColor = color; ctx.shadowBlur = 12
        ctx.beginPath(); ctx.arc(head.x, head.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},0.85)`; ctx.fill(); ctx.shadowBlur = 0
      }
    }

    /* ── Labels ── */
    function drawLabels(sc: number) {
      ctx.textAlign = 'center'
      for (const aw of agentWorld) {
        const a = AGENTS[aw.idx], sp = positions[aw.idx]
        const ly = sp.y + (PLAT + 18) * sc * 0.5
        ctx.font = `600 ${Math.max(9 * sc, 8)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `rgba(${hrgb(a.color)},0.65)`
        ctx.fillText(a.name.toUpperCase(), sp.x, ly)
        ctx.font = `${Math.max(7 * sc, 6)}px ui-sans-serif, system-ui, sans-serif`
        ctx.fillStyle = `rgba(${hrgb(a.color)},0.25)`
        ctx.fillText('ACTIVE', sp.x, ly + 10 * sc)
      }
      // Orchestrator
      ctx.font = `bold ${Math.max(10 * sc, 8)}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = `rgba(${hrgb(ORANGE)},0.55)`
      ctx.fillText('ORCHESTRATOR', positions[6].x, positions[6].y + (CTR + 20) * sc * 0.5)
    }

    /* ── Main Draw Loop ── */
    function draw() {
      frame++
      const sc = Math.min(w, h) / 750
      const px = (mouseRef.current.x - 0.5) * 18 * sc
      const py = (mouseRef.current.y - 0.5) * 10 * sc
      const cx = w * 0.58 + px, cy = h * 0.5 + py

      computePositions(cx, cy, sc)

      // Background
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h)
      const vg = ctx.createRadialGradient(w * 0.55, h * 0.5, 0, w * 0.55, h * 0.5, Math.max(w, h) * 0.6)
      vg.addColorStop(0, 'rgba(12,18,40,0.3)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h)
      const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280 * sc)
      ag.addColorStop(0, 'rgba(77,208,225,0.02)'); ag.addColorStop(1, 'transparent')
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
          drawOrchestrator(positions[6].x, positions[6].y, sc)
        } else {
          const sp = positions[el.idx], a = AGENTS[el.idx]
          const orbY = sp.y - 36 * sc
          const orbR = 18 * sc
          drawPedestal(sp.x, sp.y, PLAT, a.color, sc, false)
          drawBeam(sp.x, sp.y, orbY - orbR, a.color, sc)
          drawSphere(sp.x, orbY, orbR, a.color, hrgb(a.color), sc)
          themedDrawers[el.idx](sp.x, orbY, sc, a.color)
        }
      }

      drawParticles()
      drawLabels(sc)

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

/* ═══════════════════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════════════════ */
function UserIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function ShieldIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}`
}

/* ═══════════════════════════════════════════════════════
   PERSONA CARD
   ═══════════════════════════════════════════════════════ */
function PersonaCard({
  icon, title, subtitle, description, color, onClick,
}: {
  icon: React.ReactNode; title: string; subtitle: string; description: string
  color: string; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', width: '100%', maxWidth: '380px', padding: '32px 28px',
        borderRadius: '20px', cursor: 'pointer',
        background: hovered
          ? `linear-gradient(135deg, rgba(${hexToRgb(color)}, 0.1) 0%, rgba(12, 16, 30, 0.92) 100%)`
          : 'rgba(12, 16, 30, 0.85)',
        border: `1px solid ${hovered ? color + '50' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 20px 50px ${color}20, 0 0 60px ${color}08, inset 0 1px 0 rgba(255,255,255,0.08)`
          : '0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: hovered ? '70%' : '20%', height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        transition: 'width 0.4s ease', opacity: hovered ? 0.9 : 0.3,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hovered ? `0 0 24px ${color}15` : 'none',
          transition: 'box-shadow 0.4s',
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>
            {subtitle}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>
          <div style={{
            marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', fontWeight: 600, color: hovered ? color : '#64748b', transition: 'color 0.3s',
          }}>
            <span>Sign In</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 0.3s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   LOGIN FORM (polished with input icons, shimmer)
   ═══════════════════════════════════════════════════════ */
function LoginForm({
  persona, color, onLogin, onBack,
}: {
  persona: 'policyholder' | 'adjuster'
  color: string
  onLogin: (token: string, user: { id: number; email: string; role: string; name: string }) => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const demoEmail = persona === 'policyholder' ? 'user285@mail.com' : 'adjuster@demo.com'
  const title = persona === 'policyholder' ? 'Policyholder' : 'Claim Adjuster'
  const subtitle = persona === 'policyholder'
    ? 'Access your policies and submit claims'
    : 'Review, investigate and adjudicate claims'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.detail || 'Invalid credentials'); setLoading(false); return }
      const d = await res.json(); onLogin(d.token, d.user)
    } catch { setError('Network error. Please try again.') }
    setLoading(false)
  }

  const fillDemo = () => { setEmail(demoEmail); setPassword('demo123') }

  return (
    <div style={{
      width: '100%', maxWidth: '400px', padding: '36px 36px 30px',
      background: 'rgba(12, 16, 30, 0.9)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
      boxShadow: `0 20px 50px rgba(0,0,0,0.4), 0 0 80px ${color}06`,
    }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '50%', height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5,
      }} />

      {/* Back */}
      <button onClick={onBack} style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px', color: '#94a3b8', padding: '6px 10px', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500,
        marginBottom: '20px',
      }}>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '4px 12px', borderRadius: '100px',
          background: `${color}10`, border: `1px solid ${color}20`, marginBottom: '10px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{title}</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Welcome Back</h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {[
          { key: 'email', label: 'Email Address', type: 'email', placeholder: 'you@company.com', value: email, onChange: setEmail,
            icon: <path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
          { key: 'password', label: 'Password', type: 'password', placeholder: 'Enter password', value: password, onChange: setPassword,
            icon: <path strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
        ].map(f => (
          <div key={f.key}>
            <label style={{
              display: 'block', fontSize: '10px', fontWeight: 600,
              color: focusedField === f.key ? color : '#64748b',
              marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px', transition: 'color 0.3s',
            }}>{f.label}</label>
            <div style={{
              position: 'relative', borderRadius: '10px',
              border: `1px solid ${focusedField === f.key ? color + '45' : 'rgba(255,255,255,0.07)'}`,
              background: focusedField === f.key ? `${color}05` : 'rgba(255,255,255,0.02)',
              transition: 'all 0.3s',
            }}>
              <div style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: focusedField === f.key ? color : '#475569', transition: 'color 0.3s',
              }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">{f.icon}</svg>
              </div>
              <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)}
                onFocus={() => setFocusedField(f.key)} onBlur={() => setFocusedField(null)}
                placeholder={f.placeholder} required
                style={{
                  width: '100%', padding: '10px 12px 10px 34px', fontSize: '13px',
                  color: '#e2e8f0', backgroundColor: 'transparent', border: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        ))}

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          position: 'relative', padding: '11px', fontSize: '13px', fontWeight: 600, color: '#fff',
          background: loading ? '#475569' : `linear-gradient(135deg, ${color}, ${color}cc)`,
          border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : `0 6px 20px ${color}25`, letterSpacing: '0.4px', overflow: 'hidden',
        }}>
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

      {/* Demo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 12px' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
        <span style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Access</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <button onClick={fillDemo} type="button" style={{
        width: '100%', padding: '12px 14px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '12px',
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '11px' }}>Demo Account</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>{demoEmail} / demo123</div>
        </div>
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN DEV HOME PAGE
   ═══════════════════════════════════════════════════════ */
interface DevHomePageProps {
  onLogin: (token: string, user: { id: number; email: string; role: string; name: string }) => void
}

export default function DevHomePage({ onLogin }: DevHomePageProps) {
  const [selectedPersona, setSelectedPersona] = useState<'policyholder' | 'adjuster' | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  const handleSelectPersona = (p: 'policyholder' | 'adjuster') => {
    setTransitioning(true)
    setTimeout(() => { setSelectedPersona(p); setTransitioning(false) }, 350)
  }

  const handleBack = () => {
    setTransitioning(true)
    setTimeout(() => { setSelectedPersona(null); setTransitioning(false) }, 350)
  }

  return (
    <div style={{
      height: '100vh', background: BG, position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    }}>
      {/* Canvas background */}
      <AgentScene />

      {/* Left-side gradient: darkens far-left text zone so branding is readable */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(to right, rgba(5,8,16,0.97) 0%, rgba(5,8,16,0.95) 25%, rgba(5,8,16,0.7) 38%, rgba(5,8,16,0.25) 50%, transparent 60%)',
      }} />

      {/* Right-side gradient: darkens cards area */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(to left, rgba(5,8,16,0.8) 0%, rgba(5,8,16,0.45) 25%, transparent 50%)',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 55% 50%, transparent 35%, rgba(0,0,0,0.4) 100%)',
      }} />

      {/* ── Content: split layout ── */}
      <div style={{
        position: 'relative', zIndex: 2, width: '100%', maxWidth: '1200px',
        margin: '0 auto', padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '60px',
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* ── LEFT: Branding ── */}
        <div style={{ flex: '0 1 460px', minWidth: '320px' }}>
          <img src={exlLogo} alt="EXL" style={{ height: '34px', marginBottom: '28px', opacity: 0.9 }} />

          <div style={{
            fontSize: '11px', fontWeight: 500, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '3.5px', marginBottom: '12px',
          }}>
            AI-Powered Intelligence
          </div>

          <h1 style={{
            fontSize: '38px', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.03em',
            lineHeight: 1.15,
            background: `linear-gradient(135deg, #f1f5f9 30%, ${PURPLE}99)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Autonomous Claims<br />Investigation &<br />
            <span style={{ background: `linear-gradient(135deg, ${ORANGE}, #f97316)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Fraud Intelligence
            </span>
          </h1>

          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 32px', lineHeight: 1.6, maxWidth: '400px' }}>
            Multi-agent AI system that autonomously investigates insurance claims,
            detects fraud patterns, and provides real-time intelligence.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '7 Specialized AI Agents', color: PURPLE },
              { label: 'Real-Time Fraud Analysis', color: ORANGE },
              { label: 'Neural Pattern Detection', color: CYAN },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: f.color,
                  boxShadow: `0 0 8px ${f.color}60`,
                }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Persona cards or Login form ── */}
        <div style={{ flex: '0 1 420px', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedPersona === null ? (
            <>
              <PersonaCard
                icon={<UserIcon color={CYAN} />}
                title="Policyholder"
                subtitle="Policyholder Portal"
                description="View policies, submit claims with AI-assisted form filling, and track claim status."
                color={CYAN}
                onClick={() => handleSelectPersona('policyholder')}
              />
              <PersonaCard
                icon={<ShieldIcon color={ORANGE} />}
                title="Claim Adjuster"
                subtitle="Investigation Hub"
                description="Analyze claims with 7 specialized AI agents, real-time fraud detection and loss cause analysis."
                color={ORANGE}
                onClick={() => handleSelectPersona('adjuster')}
              />
            </>
          ) : (
            <LoginForm
              persona={selectedPersona}
              color={selectedPersona === 'adjuster' ? ORANGE : CYAN}
              onLogin={onLogin}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  )
}
