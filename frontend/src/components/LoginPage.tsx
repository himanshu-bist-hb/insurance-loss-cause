/**
 * Ultra-modern AI-themed Login Page
 * Separate persona selection with futuristic animations
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import exlLogo from '../assets/images/exl_logo.png'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'
const CYAN = '#06b6d4'
const PURPLE = '#8b5cf6'

interface LoginPageProps {
  onLogin: (token: string, user: { id: number; email: string; role: string; name: string }) => void
  adminOnly?: boolean
}

/* ═══════════════════════════════════════════════════════════════
   AI NEURAL BACKGROUND — Enhanced with more nodes, glow & scan
   ═══════════════════════════════════════════════════════════════ */
function AIBackground({ accentColor }: { accentColor: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const mouse = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0
    const NODE_COUNT = 60
    const EDGE_DIST = 180
    let frame = 0

    interface N { x: number; y: number; r: number; vx: number; vy: number; phase: number; layer: number }
    interface P { from: number; to: number; t: number; speed: number }

    let nodes: N[] = []
    let particles: P[] = []

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    function init() {
      nodes = []
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: rand(0, w), y: rand(0, h),
          r: rand(1.5, 3),
          vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3),
          phase: rand(0, Math.PI * 2),
          layer: Math.random() < 0.15 ? 1 : 0,
        })
      }
      particles = []
      for (let i = 0; i < 25; i++) {
        particles.push({
          from: Math.floor(rand(0, NODE_COUNT)),
          to: Math.floor(rand(0, NODE_COUNT)),
          t: Math.random(),
          speed: rand(0.003, 0.008),
        })
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      init()
    }

    function animate() {
      ctx.clearRect(0, 0, w, h)
      frame++

      // Update nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.phase += 0.01
        if (n.x < -20) n.x = w + 20
        if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20
        if (n.y > h + 20) n.y = -20

        // Mouse repulsion
        const dx = n.x - mouse.current.x
        const dy = n.y - mouse.current.y
        const dist = Math.hypot(dx, dy)
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 0.5
          n.x += (dx / dist) * force
          n.y += (dy / dist) * force
        }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < EDGE_DIST) {
            const alpha = (1 - d / EDGE_DIST) * 0.12
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = a.layer || b.layer
              ? `rgba(${hexToRgb(accentColor)}, ${alpha * 1.5})`
              : `rgba(255, 255, 255, ${alpha * 0.5})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const br = n.r + Math.sin(n.phase) * 0.8
        const glow = n.layer ? 12 : 0

        if (glow) {
          ctx.shadowColor = accentColor
          ctx.shadowBlur = glow
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, br, 0, Math.PI * 2)
        ctx.fillStyle = n.layer
          ? `rgba(${hexToRgb(accentColor)}, 0.6)`
          : `rgba(255, 255, 255, 0.15)`
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Draw traveling particles
      ctx.shadowColor = accentColor
      ctx.shadowBlur = 8
      for (const p of particles) {
        p.t += p.speed
        if (p.t >= 1) {
          p.from = p.to
          p.to = Math.floor(rand(0, NODE_COUNT))
          p.t = 0
        }
        const a = nodes[p.from], b = nodes[p.to]
        if (!a || !b) continue
        const px = a.x + (b.x - a.x) * p.t
        const py = a.y + (b.y - a.y) * p.t
        ctx.beginPath()
        ctx.arc(px, py, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${hexToRgb(accentColor)}, 0.5)`
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // Horizontal scan line
      const scanY = (frame * 0.5) % h
      const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2)
      scanGrad.addColorStop(0, 'transparent')
      scanGrad.addColorStop(0.5, `rgba(${hexToRgb(accentColor)}, 0.06)`)
      scanGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 30, w, 60)

      raf.current = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    canvas.addEventListener('mousemove', handleMouse)

    raf.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouse)
    }
  }, [accentColor])

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      zIndex: 0, pointerEvents: 'auto',
    }} />
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

/* ═══════════════════════════════════════════════════════
   FLOATING ORBS — ambient gradient spheres
   ═══════════════════════════════════════════════════════ */
function FloatingOrbs({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[
        { size: 500, x: '10%', y: '-10%', delay: '0s', duration: '20s' },
        { size: 400, x: '70%', y: '60%', delay: '5s', duration: '25s' },
        { size: 300, x: '80%', y: '10%', delay: '10s', duration: '18s' },
        { size: 350, x: '-5%', y: '70%', delay: '3s', duration: '22s' },
      ].map((orb, i) => (
        <div
          key={i}
          className="login-orb"
          style={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}12 0%, ${color}06 40%, transparent 70%)`,
            filter: 'blur(40px)',
            animationDelay: orb.delay,
            animationDuration: orb.duration,
          }}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TYPING EFFECT
   ═══════════════════════════════════════════════════════ */
function TypingText({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(iv)
        setTimeout(() => setShowCursor(false), 2000)
      }
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed])

  return (
    <span>
      {displayed}
      {showCursor && <span className="login-cursor">|</span>}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   PERSONA CARD
   ═══════════════════════════════════════════════════════ */
function PersonaCard({
  icon, title, subtitle, description, color, onClick, delay,
}: {
  icon: React.ReactNode; title: string; subtitle: string; description: string
  color: string; onClick: () => void; delay: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="login-card-enter"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        animationDelay: delay,
        position: 'relative',
        width: '340px',
        padding: '40px 32px',
        borderRadius: '24px',
        cursor: 'pointer',
        background: hovered
          ? `linear-gradient(135deg, rgba(${hexToRgb(color)}, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)`
          : 'rgba(15, 23, 42, 0.7)',
        border: `1px solid ${hovered ? color + '60' : 'rgba(255,255,255,0.06)'}`,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 25px 60px ${color}25, 0 0 80px ${color}10, inset 0 1px 0 rgba(255,255,255,0.1)`
          : '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Glow line at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: hovered ? '80%' : '30%',
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        transition: 'width 0.5s ease',
        opacity: hovered ? 1 : 0.4,
      }} />

      {/* Corner accent */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        transition: 'opacity 0.5s',
        opacity: hovered ? 1 : 0.3,
      }} />

      {/* Icon */}
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '20px',
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
        transition: 'all 0.4s ease',
        boxShadow: hovered ? `0 0 30px ${color}20` : 'none',
      }}>
        {icon}
      </div>

      {/* Title */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: color,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '8px',
      }}>
        {subtitle}
      </div>

      <h2 style={{
        fontSize: '24px',
        fontWeight: 700,
        color: '#f1f5f9',
        margin: '0 0 12px',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h2>

      <p style={{
        fontSize: '14px',
        color: '#94a3b8',
        margin: 0,
        lineHeight: 1.6,
      }}>
        {description}
      </p>

      {/* Arrow indicator */}
      <div style={{
        marginTop: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: 600,
        color: hovered ? color : '#64748b',
        transition: 'all 0.3s',
      }}>
        <span>Sign In</span>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: hovered ? 'translateX(4px)' : 'none', transition: 'transform 0.3s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </div>

      {/* Scan line effect */}
      {hovered && (
        <div className="login-scan-line" style={{
          position: 'absolute', left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        }} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   AI BRAIN SVG ICON
   ═══════════════════════════════════════════════════════ */
function AiBrainIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path strokeLinecap="round" d="M12 2a4 4 0 0 1 4 4c0 .74-.2 1.44-.57 2.04A5 5 0 0 1 19 13a5 5 0 0 1-3 4.58V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.42A5 5 0 0 1 5 13a5 5 0 0 1 3.57-4.96A4 4 0 0 1 8 6a4 4 0 0 1 4-4z" />
      <circle cx="10" cy="10" r="1" fill={color} />
      <circle cx="14" cy="10" r="1" fill={color} />
      <circle cx="12" cy="14" r="1" fill={color} />
      <path strokeLinecap="round" d="M10 10l2 4m2-4l-2 4" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   SHIELD ICON
   ═══════════════════════════════════════════════════════ */
function ShieldIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   USER ICON
   ═══════════════════════════════════════════════════════ */
function UserIcon({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   LOGIN FORM — Persona-specific
   ═══════════════════════════════════════════════════════ */
function LoginForm({
  persona,
  color,
  onLogin,
  onBack,
}: {
  persona: 'policyholder' | 'adjuster' | 'admin'
  color: string
  onLogin: LoginPageProps['onLogin']
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [demoUsers, setDemoUsers] = useState<{ id: number; email: string; name: string; policy_id?: string }[]>([])

  // Fetch real policyholder accounts from the backend
  useEffect(() => {
    if (persona !== 'policyholder') return
    fetch(`${API_BASE_URL}/api/auth/demo-users`)
      .then(r => r.json())
      .then(data => setDemoUsers(data))
      .catch(() => setDemoUsers([]))
  }, [persona])

  const filteredUsers = !userSearch.trim() ? demoUsers : demoUsers.filter(u => {
    const q = userSearch.toLowerCase().trim()
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || String(u.id).includes(q) || (u.policy_id && u.policy_id.toLowerCase().includes(q))
  })

  const demoEmail = persona === 'policyholder' ? 'user285@mail.com' : persona === 'admin' ? 'admin@exl.com' : 'adjuster@demo.com'
  const demoPass = persona === 'admin' ? 'admin123' : 'demo123'
  const title = persona === 'policyholder' ? 'Policyholder' : persona === 'admin' ? 'Administrator' : 'Claim Adjuster'
  const subtitle = persona === 'policyholder'
    ? 'Access your policies and submit claims'
    : persona === 'admin' ? 'Manage policies and system configuration'
    : 'Review, investigate and adjudicate claims'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Invalid credentials')
        setLoading(false)
        return
      }

      const data = await res.json()
      onLogin(data.token, data.user)
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  const fillDemo = useCallback(() => {
    setEmail(demoEmail)
    setPassword(demoPass)
  }, [demoEmail, demoPass])

  return (
    <div className="login-form-enter" style={{
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: '480px',
      minWidth: '440px',
      maxHeight: 'calc(100vh - 48px)',
      padding: '40px 44px 36px',
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '24px',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      boxShadow: `0 25px 60px rgba(0,0,0,0.4), 0 0 100px ${color}08`,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    }}>
      {/* Top glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '60%',
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Back button */}
      <button
        onClick={onBack}
        className="login-back-btn"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          color: '#94a3b8',
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 500,
          transition: 'all 0.3s',
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '16px', flexShrink: 0 }}>
        <img src={exlLogo} alt="EXL" style={{ height: '30px', marginBottom: '16px', opacity: 0.9 }} />

        {/* Persona badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 14px',
          borderRadius: '100px',
          background: `${color}12`,
          border: `1px solid ${color}25`,
          marginBottom: '12px',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            {title}
          </span>
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#f1f5f9',
          margin: '0 0 4px',
          letterSpacing: '-0.03em',
        }}>
          Welcome Back
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        {/* Email */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 600,
            color: focusedField === 'email' ? color : '#64748b',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'color 0.3s',
          }}>
            Email Address
          </label>
          <div style={{
            position: 'relative',
            borderRadius: '12px',
            border: `1px solid ${focusedField === 'email' ? color + '50' : 'rgba(255,255,255,0.08)'}`,
            background: focusedField === 'email' ? `${color}06` : 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s',
            boxShadow: focusedField === 'email' ? `0 0 20px ${color}10` : 'none',
          }}>
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: focusedField === 'email' ? color : '#475569',
              transition: 'color 0.3s',
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@company.com"
              required
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                fontSize: '14px',
                color: '#e2e8f0',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 600,
            color: focusedField === 'password' ? color : '#64748b',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'color 0.3s',
          }}>
            Password
          </label>
          <div style={{
            position: 'relative',
            borderRadius: '12px',
            border: `1px solid ${focusedField === 'password' ? color + '50' : 'rgba(255,255,255,0.08)'}`,
            background: focusedField === 'password' ? `${color}06` : 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s',
            boxShadow: focusedField === 'password' ? `0 0 20px ${color}10` : 'none',
          }}>
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: focusedField === 'password' ? color : '#475569',
              transition: 'color 0.3s',
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter password"
              required
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                fontSize: '14px',
                color: '#e2e8f0',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="login-shake" style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="login-submit-btn"
          style={{
            position: 'relative',
            padding: '13px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            background: loading
              ? '#475569'
              : `linear-gradient(135deg, ${color}, ${color}cc)`,
            border: 'none',
            borderRadius: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            overflow: 'hidden',
            transition: 'all 0.3s',
            boxShadow: loading ? 'none' : `0 8px 24px ${color}30`,
            letterSpacing: '0.5px',
          }}
        >
          {/* Shimmer effect */}
          {!loading && <div className="login-btn-shimmer" style={{
            position: 'absolute',
            top: 0, left: '-100%',
            width: '100%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
          }} />}
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span className="login-spinner" style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
              }} />
              Authenticating...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Sign In
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          )}
        </button>
      </form>

      {/* Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '18px 0 14px',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {persona === 'policyholder' ? 'Select Demo User' : 'Quick Access'}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {persona === 'policyholder' ? (
        /* ── Policyholder: searchable user list ── */
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const }}>
          {/* Search input */}
          <div style={{
            position: 'relative',
            marginBottom: '10px',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#475569',
              pointerEvents: 'none',
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name, email, or ID..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                fontSize: '12px',
                color: '#e2e8f0',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {userSearch && (
              <span style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                color: '#64748b',
              }}>
                {filteredUsers.length} found
              </span>
            )}
          </div>

          {/* Scrollable user list */}
          <div className="login-user-list" style={{
            flex: 1,
            minHeight: '120px',
            overflowY: 'auto',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {filteredUsers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>
                No users match your search
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setEmail(u.email)
                      setPassword('demo123')
                      setSelectedUserId(u.id)
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: isSelected ? `${color}12` : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      color: '#94a3b8',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: isSelected
                        ? `linear-gradient(135deg, ${color}30, ${color}15)`
                        : 'rgba(255,255,255,0.06)',
                      border: isSelected ? `1px solid ${color}40` : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isSelected ? color : '#64748b',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}>
                      {u.id}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isSelected ? '#f1f5f9' : '#cbd5e1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {u.name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isSelected ? `${color}cc` : '#64748b',
                      }}>
                        {u.email}
                      </div>
                    </div>

                    {/* Selected check */}
                    {isSelected && (
                      <svg width="16" height="16" fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer merged into one line */}
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '10px',
            color: '#475569',
            flexShrink: 0,
          }}>
            <span>{demoUsers.length} accounts &middot; Pass: <span style={{ color: '#94a3b8' }}>demo123</span></span>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              256-bit encrypted
            </span>
          </div>
        </div>
      ) : (
        /* ── Adjuster: single demo account + footer ── */
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={fillDemo}
            type="button"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.3s',
              color: '#94a3b8',
              fontSize: '13px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${color}08`
              e.currentTarget.style.borderColor = `${color}20`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: `${color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '12px' }}>Demo Account</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{demoEmail} / demo123</div>
            </div>
          </button>

          {/* Security footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '16px',
            fontSize: '11px',
            color: '#475569',
          }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secured with 256-bit encryption
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function LoginPage({ onLogin, adminOnly }: LoginPageProps) {
  const [selectedPersona, setSelectedPersona] = useState<'policyholder' | 'adjuster' | 'admin' | null>(adminOnly ? 'admin' : null)
  const [transitioning, setTransitioning] = useState(false)

  const accentColor = selectedPersona === 'adjuster' ? ORANGE
    : selectedPersona === 'admin' ? '#10b981'
    : selectedPersona === 'policyholder' ? CYAN
      : PURPLE

  const handleSelectPersona = (p: 'policyholder' | 'adjuster' | 'admin') => {
    setTransitioning(true)
    setTimeout(() => {
      setSelectedPersona(p)
      setTransitioning(false)
    }, 400)
  }

  const handleBack = () => {
    if (adminOnly) {
      window.location.pathname = '/'
      return
    }
    setTransitioning(true)
    setTimeout(() => {
      setSelectedPersona(null)
      setTransitioning(false)
    }, 400)
  }

  return (
    <div style={{
      height: '100vh',
      background: 'linear-gradient(135deg, #070b14 0%, #0f172a 50%, #0c1222 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background layers */}
      <AIBackground accentColor={accentColor} />
      <FloatingOrbs color={accentColor} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'scale(0.95)' : 'scale(1)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {selectedPersona === null ? (
          /* ── PERSONA SELECTION ── */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '48px',
          }}>
            {/* Branding */}
            <div style={{ textAlign: 'center' }} className="login-header-enter">
              <img
                src={exlLogo}
                alt="EXL"
                style={{ height: '36px', marginBottom: '24px', opacity: 0.9 }}
              />
              <h1 style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#64748b',
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '4px',
              }}>
                <TypingText text="AI-Powered Intelligence" speed={45} />
              </h1>
              <h2 style={{
                fontSize: '40px',
                fontWeight: 800,
                margin: '0 0 8px',
                letterSpacing: '-0.03em',
                background: `linear-gradient(135deg, #f1f5f9, ${PURPLE}aa)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2,
              }}>
                Autonomous Claims Investigation &<br />Fraud Intelligence
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#475569',
                margin: '12px 0 0',
                maxWidth: '500px',
              }}>
                Select your role to access the intelligent claims platform
              </p>
            </div>

            {/* Persona cards */}
            <div style={{
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              <PersonaCard
                icon={<UserIcon color={CYAN} />}
                title="Policyholder"
                subtitle="Policyholder Portal"
                description="View your policies, submit claims with AI-assisted form filling, and track claim status."
                color={CYAN}
                onClick={() => handleSelectPersona('policyholder')}
                delay="0.1s"
              />
              <PersonaCard
                icon={<ShieldIcon color={ORANGE} />}
                title="Claim Adjuster"
                subtitle="Investigation Hub"
                description="Analyze claims with 6 specialized AI agents, real-time fraud detection and loss cause analysis."
                color={ORANGE}
                onClick={() => handleSelectPersona('adjuster')}
                delay="0.25s"
              />
            </div>

            {/* Bottom AI indicator */}
            <div className="login-header-enter" style={{
              animationDelay: '0.5s',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px 24px',
              borderRadius: '100px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <AiBrainIcon color={PURPLE} size={20} />
              <div style={{ display: 'flex', gap: '24px' }}>
                {['7 AI Agents', 'Real-Time Analysis', 'Neural Fraud Detection'].map((label, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#64748b',
                  }}>
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: PURPLE,
                      opacity: 0.6,
                    }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── LOGIN FORM ── */
          <LoginForm
            persona={selectedPersona}
            color={selectedPersona === 'adjuster' ? ORANGE : selectedPersona === 'admin' ? '#10b981' : CYAN}
            onLogin={onLogin}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
