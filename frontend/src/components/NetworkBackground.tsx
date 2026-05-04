/**
 * Animated neural-network background for the HomePage.
 * Pure Canvas — no external dependencies.
 */
import { useRef, useEffect } from 'react'

const ORANGE = '#fa4e0a'
const NODE_COUNT = 15
const PARTICLE_COUNT = 10
const EDGE_DIST = 250
const PULSE_INTERVAL = 240 // frames (~4s at 60fps)

interface Node {
  x: number; y: number; r: number; accent: boolean
  vx: number; vy: number; phase: number
}
interface Particle { edge: number; t: number; speed: number; fwd: boolean }
interface Pulse { node: number; age: number; max: number }

export default function NetworkBackground() {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0
    let nodes: Node[] = []
    let edges: [number, number][] = []
    let particles: Particle[] = []
    let pulses: Pulse[] = []
    let frame = 0

    /* ── helpers ── */
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    function generateNodes() {
      nodes = []
      const cx = w / 2, cy = h / 2
      const minDist = Math.min(w, h) * 0.2 // center exclusion radius
      for (let i = 0; i < NODE_COUNT; i++) {
        let x: number, y: number
        let tries = 0
        do {
          x = rand(40, w - 40)
          y = rand(40, h - 40)
          tries++
        } while (Math.hypot(x - cx, y - cy) < minDist && tries < 30)
        nodes.push({
          x, y,
          r: rand(2, 3.5),
          accent: Math.random() < 0.2,
          vx: rand(-0.12, 0.12),
          vy: rand(-0.12, 0.12),
          phase: rand(0, Math.PI * 2),
        })
      }
    }

    function computeEdges() {
      edges = []
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < EDGE_DIST) {
            edges.push([i, j])
          }
        }
      }
    }

    function initParticles() {
      particles = []
      if (edges.length === 0) return
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          edge: Math.floor(Math.random() * edges.length),
          t: Math.random(),
          speed: rand(0.002, 0.004),
          fwd: Math.random() > 0.5,
        })
      }
    }

    /* ── resize ── */
    let resizeTimer: ReturnType<typeof setTimeout>
    function resize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const dpr = window.devicePixelRatio || 1
        w = canvas.clientWidth
        h = canvas.clientHeight
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        generateNodes()
        computeEdges()
        initParticles()
      }, 100)
    }

    /* ── draw loop ── */
    function animate() {
      ctx.clearRect(0, 0, w, h)
      frame++

      // Update nodes (drift + bounce)
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.phase += 0.008
        if (n.x < 20 || n.x > w - 20) n.vx *= -1
        if (n.y < 20 || n.y > h - 20) n.vy *= -1
      }

      // Recompute edges periodically
      if (frame % 10 === 0) computeEdges()

      // Draw edges
      ctx.lineWidth = 0.5
      for (const [i, j] of edges) {
        const a = nodes[i], b = nodes[j]
        const accent = a.accent || b.accent
        ctx.strokeStyle = accent
          ? 'rgba(250, 78, 10, 0.045)'
          : 'rgba(255, 255, 255, 0.035)'
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // Draw nodes (breathing)
      for (const n of nodes) {
        const br = n.r + Math.sin(n.phase) * 0.5
        ctx.beginPath()
        ctx.arc(n.x, n.y, br, 0, Math.PI * 2)
        ctx.fillStyle = n.accent
          ? 'rgba(250, 78, 10, 0.14)'
          : 'rgba(255, 255, 255, 0.07)'
        ctx.fill()
      }

      // Update + draw particles
      ctx.shadowColor = 'rgba(250, 78, 10, 0.35)'
      ctx.shadowBlur = 6
      for (const p of particles) {
        p.t += p.fwd ? p.speed : -p.speed
        if (p.t >= 1 || p.t <= 0) {
          // Arrived — pick a new edge from the destination node
          const dest = p.t >= 1 ? edges[p.edge]?.[1] : edges[p.edge]?.[0]
          const outgoing = edges
            .map((e, idx) => ({ e, idx }))
            .filter(({ e }) => e[0] === dest || e[1] === dest)
          if (outgoing.length > 0) {
            const pick = outgoing[Math.floor(Math.random() * outgoing.length)]
            p.edge = pick.idx
            p.fwd = pick.e[0] === dest
            p.t = p.fwd ? 0 : 1
          } else {
            p.edge = Math.floor(Math.random() * edges.length)
            p.t = Math.random()
          }
        }
        if (!edges[p.edge]) continue
        const [ai, bi] = edges[p.edge]
        const a = nodes[ai], b = nodes[bi]
        const px = a.x + (b.x - a.x) * p.t
        const py = a.y + (b.y - a.y) * p.t
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(250, 78, 10, 0.22)'
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // Pulse rings
      if (frame % PULSE_INTERVAL === 0 && pulses.length < 2) {
        pulses.push({ node: Math.floor(Math.random() * nodes.length), age: 0, max: 180 })
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.age++
        if (p.age >= p.max) { pulses.splice(i, 1); continue }
        const progress = p.age / p.max
        const n = nodes[p.node]
        ctx.beginPath()
        ctx.arc(n.x, n.y, 4 + progress * 18, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(250, 78, 10, ${0.12 * (1 - progress)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      raf.current = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)
    raf.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('resize', resize)
      clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      zIndex: 0, pointerEvents: 'none',
    }} />
  )
}
