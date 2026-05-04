/**
 * GamePage — Fraud Detective Game
 * Converted from exl-fraud-detective-v5.html reference.
 * Fetches scenarios from /api/game/scenarios (admin-selected completed claims).
 */

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import detectiveThemeUrl from '../assets/audio/detective-theme.mp3'
import { API_BASE_URL } from '../config'

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface GameScenario {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  title: string
  teaser: string
  sceneClass: string
  actualVerdict: 'fraud' | 'legitimate'
  fraudScore: number
  mlVerdict?: 'fraud' | 'legitimate'
  verdictOverridden?: boolean
  structuredData: Record<string, string>
  policyInfo: Record<string, string>
  customerInfo: Record<string, string>
  vehicleInfo: Record<string, string>
  incidentInfo: Record<string, string>
  claimNotes: string
  images: { description: string; redFlag: string | null; url?: string | null }[]
  fraudRingData: {
    pattern: string; connections: number; note: string; riskScore?: number; findings?: string[]
    linkedClaims?: { claimId: string; policyId: string; garage: string; broker: string; amount: number; fraud: boolean }[]
    entities?: {
      garage?: { name: string; totalClaims: number; fraudRate: number }
      broker?: { name: string; totalClaims: number; fraudRate: number }
      customer?: { pastClaims: number; priorFraud: number }
      zip?: { claimsCount: number; fraudRate: number }
    }
  }
  redFlags: string[]
  aiAgentFindings: Record<string, { score: number; finding: string }>
}

interface LeaderboardEntry {
  player_name: string
  score: number
  cases_played: number
  accuracy: number
  played_at?: string
  title?: string
}

interface RoundAnswer {
  round: number
  answer: string
  confidence: string
  points: number
  isCorrect: boolean
  timeSpent: number
}

interface GamePageProps {
  onBack: () => void
}

/* ═══════════════════════════════════════════════════
   SOUND SYSTEM
═══════════════════════════════════════════════════ */
const SoundCtx = createContext<{ play: (name: string) => void; soundOn: boolean }>({ play: () => {}, soundOn: true })

const makeTone = (freq: number, type: OscillatorType = 'sine', duration = 0.12, gain = 0.15) => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000)
  } catch { /* ignore */ }
}

const SOUNDS: Record<string, () => void> = {
  click: () => makeTone(880, 'sine', 0.08, 0.12),
  verdict: () => { makeTone(660, 'sine', 0.09, 0.1); setTimeout(() => makeTone(990, 'sine', 0.12, 0.08), 60) },
  conf: () => makeTone(440, 'triangle', 0.07, 0.08),
  lifeline: () => { makeTone(300, 'sawtooth', 0.15, 0.06); setTimeout(() => makeTone(600, 'sine', 0.2, 0.1), 80) },
  reveal: () => { [0, 80, 160, 240].forEach((delay, i) => setTimeout(() => makeTone(220 + i * 110, 'sine', .15, .12), delay)) },
  coin: () => { [0, 60, 120].forEach((d, i) => setTimeout(() => makeTone(800 + i * 200, 'triangle', .1, .1), d)) },
  correct: () => { makeTone(523, 'sine', 0.1, 0.1); setTimeout(() => makeTone(659, 'sine', 0.1, 0.1), 80); setTimeout(() => makeTone(784, 'sine', 0.15, 0.12), 160) },
  wrong: () => { makeTone(200, 'sawtooth', 0.15, 0.08); setTimeout(() => makeTone(180, 'sawtooth', 0.2, 0.06), 100) },
  roundStart: () => { [0, 70, 140].forEach((d, i) => setTimeout(() => makeTone(300 + i * 200, 'triangle', 0.12, 0.1), d)) },
  caseStart: () => { makeTone(220, 'sine', 0.2, 0.08); setTimeout(() => makeTone(330, 'sine', 0.25, 0.1), 120) },
  gameOver: () => { [0, 100, 200, 300, 450].forEach((d, i) => setTimeout(() => makeTone([523, 659, 784, 880, 1047][i], 'sine', 0.18, 0.12), d)) },
}

/* ═══════════════════════════════════════════════════
   BACKGROUND MUSIC — MP3 audio player with loop & volume
═══════════════════════════════════════════════════ */
class AmbientMusic {
  private audio: HTMLAudioElement | null = null
  private running = false
  private _volume = 0.35

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.audio) this.audio.volume = this._volume
  }

  get volume() { return this._volume }

  start() {
    if (this.running) return
    try {
      this.audio = new Audio(detectiveThemeUrl)
      this.audio.loop = true
      this.audio.volume = this._volume
      this.audio.play().catch(() => { /* autoplay blocked — will retry on next gesture */ })
      this.running = true
    } catch { /* ignore */ }
  }

  stop() {
    if (!this.running || !this.audio) return
    try {
      this.audio.pause()
      this.audio.currentTime = 0
      this.audio = null
      this.running = false
    } catch { this.running = false }
  }

  get isPlaying() { return this.running }
}

/* ═══════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════ */
const RED_FLAG_OPTIONS = ['Suspicious timing', 'Inflated claim amount', 'Inconsistent story details', 'Image manipulation detected', 'Fraud ring connection', 'Documentation gaps']
const getTitle = (s: number) => s >= 10000 ? 'Master Detective' : s >= 8000 ? 'Senior Inspector' : s >= 6000 ? 'Detective' : s >= 4000 ? 'Constable' : 'Cadet'
const camelLabel = (s: string) => s.replace(/([A-Z])/g, ' $1').trim()

const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/leaderboard`)
    if (res.ok) {
      const data = await res.json()
      return (data as LeaderboardEntry[]).map(e => ({ ...e, title: getTitle(e.score) }))
    }
  } catch { /* ignore */ }
  return []
}

const ROUND_META = [
  { round: 1, name: 'Structured Data', icon: '📋' },
  { round: 2, name: 'Claim Notes', icon: '🗒️' },
  { round: 3, name: 'Photo Evidence', icon: '📷' },
  { round: 4, name: 'Garage & Broker Claims', icon: '🔗' },
]

const RF_FIELDS = ['policyStartDate', 'previousClaims', 'lossDate', 'reportDate', 'claimAmount']

/* ═══════════════════════════════════════════════════
   EXL LOGO
═══════════════════════════════════════════════════ */
const EXLLogo = ({ size = 'md', showSub = true }: { size?: 'sm' | 'md' | 'lg'; showSub?: boolean }) => {
  const scale = size === 'sm' ? 0.72 : size === 'lg' ? 1.35 : 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? '.45rem' : '.6rem' }}>
      <div style={{
        width: Math.round(72 * scale), height: Math.round(36 * scale),
        borderRadius: Math.round(6 * scale), background: '#FF4E12',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 2px 12px rgba(255,78,18,.35)',
      }}>
        <span style={{ fontFamily: 'Arial Black,Arial,sans-serif', fontWeight: 900, fontSize: Math.round(16 * scale), color: '#fff', letterSpacing: '.04em', lineHeight: 1, userSelect: 'none' }}>EXL</span>
      </div>
      {showSub && size !== 'sm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.05rem' }}>
          <span style={{ fontSize: size === 'lg' ? '.75rem' : '.65rem', letterSpacing: '.14em', color: 'var(--exl-muted)', textTransform: 'uppercase', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>AI CLAIMS INTELLIGENCE</span>
        </div>
      )}
    </div>
  )
}

const DiffBadge = ({ difficulty }: { difficulty: string }) => (
  <span className={`badge badge-${difficulty}`}>{difficulty.toUpperCase()}</span>
)

/* ═══════════════════════════════════════════════════
   WELCOME SCREEN
═══════════════════════════════════════════════════ */
const WelcomeScreen = ({ onNext, leaderboard }: { onNext: () => void; leaderboard: LeaderboardEntry[] }) => {
  const { play } = useContext(SoundCtx)
  const [btnReady, setBtnReady] = useState(false)
  const medal = (i: number) => i === 0 ? { bg: '#F5C842', tc: '#3B2900' } : i === 1 ? { bg: '#8A9AB0', tc: '#1A2030' } : i === 2 ? { bg: '#CD7C4A', tc: '#2A1500' } : { bg: 'var(--exl-border)', tc: 'var(--exl-muted)' }

  useEffect(() => { const t = setTimeout(() => setBtnReady(true), 1600); return () => clearTimeout(t) }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.2fr 1fr', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 70% 70% at 30% 50%,rgba(255,80,30,.04) 0%,transparent 60%),radial-gradient(ellipse 50% 60% at 80% 30%,rgba(40,40,80,.5) 0%,transparent 70%),linear-gradient(160deg,#060810 0%,#0D1120 50%,#060810 100%)', animation: 'bgDrift 18s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg,transparent,rgba(255,107,53,.15),transparent)', animation: 'scanLine 6s ease-in-out infinite' }} />
      </div>

      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(1.5rem,3vw,3rem) clamp(1.5rem,3vh,3rem) clamp(2rem,4vw,4.5rem)', position: 'relative', zIndex: 2 }}>
        <div style={{ marginBottom: 'clamp(1rem,2vh,2.2rem)' }} className="fade-up"><EXLLogo size="lg" /></div>
        <div style={{ marginBottom: 'clamp(.5rem,1vh,1rem)' }}><h1 className="title-main">THE<br />FRAUD<br />DETECTIVE</h1></div>
        <div className="title-tagline" style={{ marginBottom: 'clamp(1rem,2vh,2rem)' }}>Can you detect fraud before the algorithm does?</div>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: 'clamp(1rem,2vh,2.2rem)', flexWrap: 'wrap', animation: 'taglineReveal .8s 1.1s ease both', opacity: 0 }}>
          {[{ n: '01', label: 'Structured Data', icon: '📋' }, { n: '02', label: 'Claim Notes', icon: '🗒️' }, { n: '03', label: 'Photo Evidence', icon: '📷' }, { n: '04', label: 'Garage & Broker Claims', icon: '🔗' }].map(({ n, label, icon }) => (
            <div key={n} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--exl-border)', borderRadius: '8px', padding: '.42rem .65rem', display: 'flex', alignItems: 'center', gap: '.42rem' }}>
              <span style={{ fontSize: '.82rem' }}>{icon}</span>
              <div>
                <div style={{ fontSize: '.58rem', color: 'var(--exl-orange)', fontWeight: 700, letterSpacing: '.1em', fontFamily: "'Oswald',sans-serif" }}>ROUND {n}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--exl-text-soft)' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ opacity: btnReady ? 1 : 0, transform: btnReady ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity .5s ease, transform .5s ease' }}>
          <button className="exl-btn exl-btn-primary glow-pulse" style={{ alignSelf: 'flex-start', fontSize: '1.08rem', padding: '1.1rem 3rem', display: 'inline-flex' }} onClick={() => { play('click'); onNext() }}>Begin Investigation →</button>
        </div>
      </div>

      {/* RIGHT — Leaderboard */}
      <div style={{ background: 'rgba(8,10,15,.7)', borderLeft: '1px solid var(--exl-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(1.5rem,2.5vw,2.5rem)', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--exl-border) 1px,transparent 1px)', backgroundSize: '100% 52px', opacity: .25 }} />
        <div style={{ position: 'relative', zIndex: 1, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
            <div style={{ fontSize: '.68rem', letterSpacing: '.2em', color: 'var(--exl-orange)', fontWeight: 700, fontFamily: "'Oswald',sans-serif", marginBottom: '.3rem' }}>INVESTIGATION LEDGER</div>
            <div style={{ fontSize: '.78rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>Top detectives — can you make the board?</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {leaderboard.slice(0, 8).map((e, i) => {
              const m = medal(i)
              return (
                <div key={i} className={`lb-row ${i === 0 ? 'lb-tier-1' : i === 1 ? 'lb-tier-2' : i === 2 ? 'lb-tier-3' : ''}`} style={{ border: '1px solid var(--exl-border)', padding: '.5rem .8rem', borderRadius: '10px', animation: `stagger1 .4s ${.05 + i * .06}s ease both`, flexShrink: 0 }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: m.bg, color: m.tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.72rem', flexShrink: 0 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.player_name}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", fontWeight: 300, letterSpacing: '.04em' }}>{e.title}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', letterSpacing: '.03em', color: i === 0 ? '#F5C842' : i === 1 ? '#C0C8D8' : i === 2 ? '#CD9060' : 'var(--exl-text-soft)', flexShrink: 0 }}>{e.score.toLocaleString()}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '1rem', fontSize: '.65rem', color: 'var(--exl-muted)', letterSpacing: '.1em', fontFamily: "'Oswald',sans-serif", fontWeight: 300, textAlign: 'center', flexShrink: 0 }}>EXL AI CLAIMS INTELLIGENCE</div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   NAME ENTRY
═══════════════════════════════════════════════════ */
interface SavedSession {
  scenario_id: number
  current_round: number
  round_answers: RoundAnswer[]
  time_left: number
  total_score: number
  lifeline_used: boolean
}

const NameEntry = ({ onStart, onResume }: { onStart: (name: string) => void; onResume: (name: string, session: SavedSession) => void }) => {
  const { play } = useContext(SoundCtx)
  const [name, setName] = useState('')
  const [checking, setChecking] = useState(false)
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null)
  const [showResumePrompt, setShowResumePrompt] = useState(false)

  const checkSession = async (playerName: string) => {
    setChecking(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/game/session/${encodeURIComponent(playerName)}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.status === 'in_progress') {
          setSavedSession({
            scenario_id: data.scenario_id,
            current_round: data.current_round,
            round_answers: data.round_answers || [],
            time_left: data.time_left,
            total_score: data.total_score,
            lifeline_used: !!data.lifeline_used,
          })
          setShowResumePrompt(true)
          setChecking(false)
          return
        }
      }
    } catch { /* ignore */ }
    setSavedSession(null)
    setChecking(false)
    play('reveal')
    onStart(playerName)
  }

  const submit = () => {
    if (name.trim()) checkSession(name.trim())
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative', background: 'linear-gradient(160deg,#060810 0%,#0A0E1A 50%,#060810 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,107,53,.05) 0%,transparent 70%)', top: '-100px', left: '-50px', animation: 'bgDrift 20s ease-in-out infinite' }} />
      </div>

      {/* LEFT — Scoring */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(1.5rem,3vw,3rem) clamp(1.5rem,3vh,3rem) clamp(2rem,4vw,4.5rem)', position: 'relative', zIndex: 1, borderRight: '1px solid var(--exl-border)', overflowY: 'auto' }}>
        <div style={{ marginBottom: 'clamp(1rem,2vh,2rem)' }} className="s1"><EXLLogo size="md" /></div>
        <div className="s2" style={{ marginBottom: 'clamp(1rem,2vh,2rem)' }}>
          <div style={{ fontSize: '.68rem', letterSpacing: '.2em', color: 'var(--exl-orange)', fontFamily: "'Oswald',sans-serif", fontWeight: 700, marginBottom: '.6rem' }}>HOW POINTS ARE BUILT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.35rem' }}>
            {[
              { icon: '⚡', label: 'Early detection', desc: 'Round 1 correct = 1,000 pts', color: 'var(--exl-orange)' },
              { icon: '⏱', label: 'Speed bonus', desc: 'Fast verdict = +250 pts', color: '#6BA3BE' },
              { icon: '🎯', label: 'High confidence', desc: 'Correct at HIGH = 1.5× pts', color: '#22D07A' },
              { icon: '🚩', label: 'Red flag accuracy', desc: '+200 pts per verified flag', color: '#FBBF24' },
              { icon: '🔗', label: 'Pattern detection', desc: 'Round 4 network bonus', color: 'var(--purple)' },
              { icon: '⚠️', label: 'Lifeline cost', desc: 'AI Assist used = −200 pts', color: '#F87171' },
            ].map(({ icon, label, desc, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--exl-border)', borderRadius: '10px', padding: '.45rem .65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', marginBottom: '.15rem' }}>
                  <span style={{ fontSize: '.8rem' }}>{icon}</span>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, color, fontFamily: "'Oswald',sans-serif", letterSpacing: '.04em' }}>{label}</span>
                </div>
                <div style={{ fontSize: '.64rem', color: 'var(--exl-muted)', paddingLeft: '1.2rem' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="s3">
          <div style={{ fontSize: '.68rem', letterSpacing: '.2em', color: 'var(--exl-orange)', fontFamily: "'Oswald',sans-serif", fontWeight: 700, marginBottom: '.5rem' }}>DETECTIVE RANK LADDER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.28rem' }}>
            {[
              { label: 'Cadet', pts: '< 4,000', color: '#5A627A', icon: '🔰' },
              { label: 'Constable', pts: '4,000+', color: '#6BA3BE', icon: '🔵' },
              { label: 'Detective', pts: '6,000+', color: '#22D07A', icon: '🟢' },
              { label: 'Senior Inspector', pts: '8,000+', color: 'var(--exl-orange)', icon: '🟠' },
              { label: 'Master Detective', pts: '10,000+', color: '#F5C842', icon: '⭐' },
            ].map((r, i) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.4rem .7rem', borderRadius: '9px', background: i === 4 ? 'rgba(245,200,66,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${i === 4 ? 'rgba(245,200,66,.2)' : 'var(--exl-border)'}` }}>
                <span style={{ fontSize: '.85rem' }}>{r.icon}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: '.78rem', color: r.color }}>{r.label}</span>
                <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.72rem', color: 'var(--exl-muted)', fontWeight: 400 }}>{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(2rem,4vw,4rem) clamp(1.5rem,3vh,3rem) clamp(1.5rem,3vw,3rem)', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: '400px' }} className="scale-in">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,107,53,.18) 0%,rgba(255,107,53,.06) 100%)', border: '2px solid rgba(255,107,53,.4)', fontSize: '2.2rem', marginBottom: '1rem', boxShadow: '0 0 30px rgba(255,107,53,.2)', animation: 'pulseRing 2.5s ease infinite' }}>🔍</div>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', letterSpacing: '.08em', marginBottom: '.3rem' }}>Identify Yourself</h2>
            <p style={{ color: 'var(--exl-muted)', fontSize: '.85rem', letterSpacing: '.03em' }}>Your name will appear on the investigation ledger</p>
          </div>
          <div className="g-card-accent" style={{ padding: '2rem' }}>
            {!showResumePrompt ? (
              <>
                <div style={{ fontSize: '.68rem', color: 'var(--exl-muted)', letterSpacing: '.12em', marginBottom: '.5rem', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>DETECTIVE NAME</div>
                <input className="exl-input" type="text" placeholder="e.g. Inspector Chen" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus style={{ fontSize: '1.05rem', padding: '1rem 1.1rem', marginBottom: '1.1rem' }} />
                <button className="exl-btn exl-btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem', letterSpacing: '.03em' }} onClick={submit} disabled={!name.trim() || checking}>{checking ? 'Checking...' : 'Access Case Files →'}</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '.68rem', color: 'var(--exl-orange)', letterSpacing: '.12em', marginBottom: '.8rem', fontFamily: "'Oswald',sans-serif", fontWeight: 700 }}>ACTIVE CASE FOUND</div>
                <div style={{ fontSize: '.88rem', color: 'var(--exl-text)', marginBottom: '.5rem', lineHeight: 1.6 }}>
                  Welcome back, <strong>{name}</strong>! You have an active investigation saved at Round {savedSession?.current_round || 1}.
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--exl-muted)', marginBottom: '1.2rem' }}>Would you like to resume or start fresh?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  <button className="exl-btn exl-btn-primary" style={{ width: '100%', padding: '.9rem', fontSize: '.95rem' }} onClick={() => { play('reveal'); onResume(name.trim(), savedSession!) }}>Resume Investigation →</button>
                  <button className="exl-btn exl-btn-ghost" style={{ width: '100%', padding: '.8rem', fontSize: '.88rem' }} onClick={async () => {
                    try { await fetch(`${API_BASE_URL}/api/game/session/${encodeURIComponent(name.trim())}`, { method: 'DELETE' }) } catch { /* ignore */ }
                    setShowResumePrompt(false); setSavedSession(null); play('reveal'); onStart(name.trim())
                  }}>Start New Game</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CASE SELECTION
═══════════════════════════════════════════════════ */
const CaseSelection = ({ playerName, scenarios, onSelect }: { playerName: string; scenarios: GameScenario[]; onSelect: (idx: number) => void }) => {
  const { play } = useContext(SoundCtx)
  const typeIcon = (t: string) => t.includes('Auto') || t.includes('Collision') ? '🚗' : t.includes('Fire') ? '🔥' : t.includes('Water') || t.includes('Flood') ? '💧' : '🏠'
  const tileThemes = [
    { glow: 'rgba(255,140,60,.18)', accent: 'var(--exl-orange)' },
    { glow: 'rgba(40,100,220,.18)', accent: '#6BA3BE' },
    { glow: 'rgba(180,40,40,.18)', accent: '#F87171' },
    { glow: 'rgba(255,140,60,.18)', accent: 'var(--exl-orange)' },
    { glow: 'rgba(220,60,20,.18)', accent: '#FB923C' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(1rem,2vh,2rem) clamp(1.5rem,3vw,3rem)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 70% at 50% 50%,rgba(255,60,20,.03) 0%,transparent 60%),var(--exl-bg)', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(.75rem,1.5vh,1.5rem)' }}>
          <div style={{ opacity: .6 }}><EXLLogo size="sm" /></div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.6rem,3vw,2.4rem)', letterSpacing: '.06em', lineHeight: 1 }}>Select Your Investigation</h2>
            <p style={{ color: 'var(--exl-muted)', fontSize: '.82rem', letterSpacing: '.05em', fontFamily: "'Oswald',sans-serif", fontWeight: 300, marginTop: '.2rem' }}>DET. {playerName.toUpperCase()} · CHOOSE ONE CASE TO INVESTIGATE</p>
          </div>
          <div style={{ width: '120px' }} />
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.min(scenarios.length, 5)},1fr)`, gap: '1rem', alignContent: 'center', overflowX: 'auto' }}>
          {scenarios.map((sc, i) => {
            const theme = tileThemes[i % tileThemes.length]
            return (
              <div key={sc.id} className={`case-tile s${Math.min(i + 1, 5)}`} style={{ '--tile-glow': theme.glow } as React.CSSProperties} onClick={() => { play('click'); onSelect(i) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{typeIcon(sc.structuredData.claimType || '')}</div>
                  <DiffBadge difficulty={sc.difficulty} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 400, fontSize: '.68rem', letterSpacing: '.16em', color: theme.accent, marginBottom: '.4rem' }}>{(sc.structuredData.claimType || 'CLAIM').toUpperCase()}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.92rem', marginBottom: '.5rem', lineHeight: 1.3 }}>{sc.title}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", fontWeight: 400, letterSpacing: '.04em', marginBottom: '.35rem' }}>Policy: {sc.structuredData.policyNumber}</div>
                  <p style={{ fontSize: '.74rem', color: 'var(--exl-muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{sc.teaser}</p>
                </div>
                <div style={{ marginTop: '1rem', paddingTop: '.75rem', borderTop: '1px solid var(--exl-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 600, color: theme.accent, fontSize: '1rem', letterSpacing: '.04em' }}>{sc.structuredData.claimAmount}</div>
                  <div style={{ fontSize: '.68rem', color: 'var(--exl-muted)', letterSpacing: '.06em' }}>4 ROUNDS ›</div>
                </div>
                <div className="case-tile-num">0{i + 1}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   GAME SCREEN
═══════════════════════════════════════════════════ */
const GameScreen = ({
  playerName, scenario, currentRound, timeLeft, playerAnswer, confidence, selectedRedFlags,
  lifelineUsed, revealedRedFlag, roundAnswers,
  onSetAnswer, onSetConfidence, onToggleRedFlag, onSubmit, onLifeline, onExitSave,
}: {
  playerName: string; scenario: GameScenario; currentRound: number; timeLeft: number;
  playerAnswer: string | null; confidence: string; selectedRedFlags: string[];
  lifelineUsed: boolean; revealedRedFlag: string | null; roundAnswers: RoundAnswer[];
  onSetAnswer: (v: string) => void; onSetConfidence: (v: string) => void;
  onToggleRedFlag: (f: string) => void; onSubmit: (a: string) => void; onLifeline: () => void; onExitSave: () => void;
}) => {
  const { play } = useContext(SoundCtx)
  const [photoModal, setPhotoModal] = useState<{ description: string; redFlag: string | null; url?: string | null } | null>(null)
  const danger = timeLeft <= 8
  const evidenceRef = useRef<HTMLDivElement>(null)
  const prevRoundRef = useRef(currentRound)

  // Auto-scroll to bottom of evidence when a new round unlocks
  useEffect(() => {
    if (currentRound > prevRoundRef.current && evidenceRef.current) {
      setTimeout(() => {
        evidenceRef.current?.scrollTo({ top: evidenceRef.current.scrollHeight, behavior: 'smooth' })
      }, 150)
    }
    prevRoundRef.current = currentRound
  }, [currentRound])

  return (
    <div className={scenario.sceneClass} style={{ height: '100vh', overflow: 'auto', padding: 'clamp(.5rem,1vh,.85rem) clamp(.75rem,1.5vw,1.25rem)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'clamp(.4rem,.8vh,.65rem)' }}>

        {/* TOP NAV */}
        <div className="g-card" style={{ padding: '.65rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <EXLLogo size="sm" />
            <div style={{ width: '1px', height: '24px', background: 'var(--exl-border)' }} />
            <div>
              <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', letterSpacing: '.08em', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>ACTIVE CASE FILE</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.88rem' }}>{scenario.title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '.75rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", letterSpacing: '.06em' }}>DET. {playerName.toUpperCase()}</div>
            <button onClick={() => { play('click'); onExitSave() }} style={{
              padding: '.4rem .8rem', fontSize: '.7rem', fontWeight: 600, fontFamily: "'Oswald',sans-serif",
              letterSpacing: '.06em', color: 'var(--exl-muted)', background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--exl-border)', borderRadius: '7px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '.35rem',
            }}>
              <span style={{ fontSize: '.8rem' }}>💾</span> EXIT & SAVE
            </button>
            <div className={danger ? 'timer-tension' : timeLeft <= 15 ? 'timer-danger' : ''} style={{
              display: 'flex', alignItems: 'center', gap: '.45rem', padding: '.45rem .95rem', borderRadius: '9px',
              background: danger ? 'rgba(240,80,80,.18)' : timeLeft <= 15 ? 'rgba(240,80,80,.1)' : 'rgba(255,107,53,.1)',
              border: `1.5px solid ${danger ? 'rgba(240,80,80,.8)' : timeLeft <= 15 ? 'rgba(240,80,80,.6)' : 'rgba(255,107,53,.45)'}`,
              color: danger || timeLeft <= 15 ? '#F87171' : 'var(--exl-orange)', fontWeight: 700, fontSize: '1rem', transition: 'all .3s',
            }}>
              <span style={{ fontSize: '.85rem' }}>⏱</span>
              <span style={{ minWidth: '2rem', textAlign: 'right', fontFamily: "'Oswald',sans-serif", fontWeight: 600 }}>{timeLeft}s</span>
            </div>
          </div>
        </div>

        {/* CASE HEADER */}
        <div className="g-card" style={{ padding: '.7rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <DiffBadge difficulty={scenario.difficulty} />
            <span className="badge" style={{ background: 'rgba(255,107,53,.1)', color: 'var(--exl-orange)', border: '1px solid rgba(255,107,53,.25)', fontFamily: "'Oswald',sans-serif", fontWeight: 400 }}>ROUND {currentRound} / 4</span>
            <span style={{ color: 'var(--exl-muted)', fontSize: '.78rem' }}>{scenario.structuredData.claimType} · {scenario.structuredData.claimAmount}</span>
          </div>
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            {ROUND_META.map(({ round, icon }) => (
              <div key={round} className={`round-dot ${currentRound === round ? 'round-dot-active' : ''}`} style={{ background: currentRound > round ? 'var(--green)' : currentRound === round ? 'var(--exl-orange)' : 'var(--exl-border)', color: '#fff', fontSize: currentRound > round ? '.6rem' : '.82rem' }}>
                {currentRound > round ? '✓' : icon}
              </div>
            ))}
          </div>
          {!lifelineUsed && currentRound >= 2 ? (
            <button className="lifeline-btn" onClick={() => { play('lifeline'); onLifeline() }}>
              <span style={{ fontSize: '1rem' }}>⚡</span>
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 700, fontFamily: "'Oswald',sans-serif", letterSpacing: '.06em' }}>AI ASSIST</div>
                <div style={{ fontSize: '.64rem', opacity: .65 }}>Contextual hint · −200 pts</div>
              </div>
            </button>
          ) : lifelineUsed ? (
            <div style={{ fontSize: '.7rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", letterSpacing: '.06em' }}>AI ASSIST USED</div>
          ) : <div />}
        </div>

        {/* EVIDENCE + VERDICT */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr clamp(260px,22vw,310px)', gap: 'clamp(.5rem,1vw,.9rem)', minHeight: 0 }}>
          {/* LEFT: Evidence — scrollable exhibits container */}
          <div ref={evidenceRef} className="evidence-scroll exhibits-container" style={{ overflowY: 'auto', paddingRight: '.35rem' }}>
            {/* Exhibit A */}
            <div className="g-card evidence-hover" style={{ padding: '1rem 1.1rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.7rem' }}>
                <span style={{ fontSize: '.95rem' }}>📋</span>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--exl-orange)' }}>Exhibit A — Structured Data</span>
                <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: currentRound === 1 ? 'var(--exl-orange)' : 'var(--green)' }}>{currentRound === 1 ? '🔓 ACTIVE' : '✓ REVIEWED'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))', gap: '.45rem' }}>
                {Object.entries(scenario.structuredData).filter(([, v]) => v && v.trim() && v.trim() !== 'None' && v.trim() !== 'nan').map(([k, v]) => {
                  const isRF = RF_FIELDS.includes(k)
                  return (
                    <div key={k} className={`data-pill ${isRF ? 'data-pill-redflag' : ''}`}>
                      <div style={{ fontSize: '.6rem', color: isRF ? 'rgba(251,191,36,.7)' : 'var(--exl-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '.18rem' }}>{camelLabel(k)}</div>
                      <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{v}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Exhibit B — Claim Notes */}
            {currentRound >= 2 && (
              <div className="g-card evidence-hover exhibit-unlock" style={{ padding: '1rem 1.1rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.7rem' }}>
                  <span style={{ fontSize: '.95rem' }}>🗒️</span>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--exl-orange)' }}>Exhibit B — Claim Notes</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: currentRound === 2 ? 'var(--exl-orange)' : 'var(--green)' }}>{currentRound === 2 ? '🔓 ACTIVE' : '✓ REVIEWED'}</span>
                </div>
                <div style={{ position: 'relative', marginTop: '.5rem' }}>
                  <div className="clipboard-panel fade-up">
                    <div className="clipboard-clip" />
                    <div className="clipboard-lines" />
                    <div className="clipboard-margin" />
                    <div className="clipboard-content" style={{ whiteSpace: 'pre-wrap' }}>{scenario.claimNotes}</div>
                    <div className="clipboard-stamp">{scenario.actualVerdict === 'fraud' ? 'Under Review' : 'Verified'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Exhibit C — Photo Evidence */}
            {currentRound >= 3 && (
              <div className="g-card evidence-hover exhibit-unlock" style={{ padding: '1rem 1.1rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.7rem' }}>
                  <span style={{ fontSize: '.95rem' }}>📷</span>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--exl-orange)' }}>Exhibit C — Photo Evidence</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: currentRound === 3 ? 'var(--exl-orange)' : 'var(--green)' }}>{currentRound === 3 ? '🔓 ACTIVE' : '✓ REVIEWED'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.5rem' }}>
                  {scenario.images.map((img, idx) => (
                    <div key={idx} className="ev-block photo-ev-block" style={{ borderColor: img.redFlag ? 'rgba(251,191,36,.2)' : 'var(--exl-border)', textAlign: 'center', padding: '.75rem .6rem', cursor: 'pointer' }} onClick={() => { play('click'); setPhotoModal(img) }}>
                      {img.url ? (
                        <img src={img.url} alt={img.description} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', marginBottom: '.4rem' }} />
                      ) : (
                        <div style={{ fontSize: '2rem', marginBottom: '.4rem' }}>📷</div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: '.78rem', marginBottom: img.redFlag ? '.25rem' : 0 }}>{img.description}</div>
                      <div style={{ fontSize: '.62rem', color: 'var(--exl-muted)', marginTop: '.3rem' }}>Click to examine</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exhibit D — Garage & Broker Claims */}
            {currentRound >= 4 && (() => {
              const frd = scenario.fraudRingData
              const ent = frd.entities || {}
              const claims = frd.linkedClaims || []
              const garageName = ent.garage?.name && ent.garage.name !== 'Unknown' ? ent.garage.name : null
              const brokerName = ent.broker?.name && ent.broker.name !== 'Unknown' ? ent.broker.name : null
              const fraudCount = claims.filter(c => c.fraud).length

              return (
              <div className="g-card evidence-hover exhibit-unlock" style={{ padding: '1rem 1.1rem', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.7rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '.95rem' }}>🔗</span>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.85rem', color: 'var(--exl-orange)' }}>Exhibit D — Garage & Broker Claims</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--exl-orange)' }}>🔓 ACTIVE</span>
                </div>

                {/* Garage & Broker names */}
                {(garageName || brokerName) && (
                <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.6rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  {garageName && <span className="badge" style={{ background: 'rgba(255,107,53,.1)', color: 'var(--exl-orange)', border: '1px solid rgba(255,107,53,.25)', fontSize: '.72rem', padding: '.2rem .6rem' }}>🔧 {garageName}</span>}
                  {brokerName && <span className="badge" style={{ background: 'rgba(99,102,241,.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,.25)', fontSize: '.72rem', padding: '.2rem .6rem' }}>🏢 {brokerName}</span>}
                  {claims.length > 0 && <span style={{ fontSize: '.72rem', color: 'var(--exl-muted)', alignSelf: 'center' }}>{claims.length} linked claims · {fraudCount} fraudulent</span>}
                </div>
                )}

                {/* Linked Claims Table */}
                {claims.length > 0 ? (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--exl-border)', position: 'sticky', top: 0, background: 'var(--exl-surface)' }}>
                        <th style={{ textAlign: 'left', padding: '.35rem .5rem', color: 'var(--exl-muted)', fontWeight: 600, fontSize: '.65rem', letterSpacing: '.06em' }}>POLICY</th>
                        <th style={{ textAlign: 'left', padding: '.35rem .5rem', color: 'var(--exl-muted)', fontWeight: 600, fontSize: '.65rem', letterSpacing: '.06em' }}>GARAGE</th>
                        <th style={{ textAlign: 'left', padding: '.35rem .5rem', color: 'var(--exl-muted)', fontWeight: 600, fontSize: '.65rem', letterSpacing: '.06em' }}>BROKER</th>
                        <th style={{ textAlign: 'right', padding: '.35rem .5rem', color: 'var(--exl-muted)', fontWeight: 600, fontSize: '.65rem', letterSpacing: '.06em' }}>AMOUNT</th>
                        <th style={{ textAlign: 'center', padding: '.35rem .5rem', color: 'var(--exl-muted)', fontWeight: 600, fontSize: '.65rem', letterSpacing: '.06em' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '.3rem .5rem', fontWeight: 500 }}>{c.policyId}</td>
                          <td style={{ padding: '.3rem .5rem', color: 'var(--exl-muted)' }}>{c.garage || '—'}</td>
                          <td style={{ padding: '.3rem .5rem', color: 'var(--exl-muted)' }}>{c.broker || '—'}</td>
                          <td style={{ padding: '.3rem .5rem', textAlign: 'right', fontWeight: 500 }}>${c.amount.toLocaleString()}</td>
                          <td style={{ padding: '.3rem .5rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '.12rem .45rem', borderRadius: '4px',
                              background: c.fraud ? 'rgba(240,80,80,.15)' : 'rgba(34,208,122,.1)',
                              color: c.fraud ? '#F87171' : '#22D07A',
                              border: `1px solid ${c.fraud ? 'rgba(240,80,80,.3)' : 'rgba(34,208,122,.25)'}`,
                            }}>{c.fraud ? 'FRAUD' : 'LEGIT'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <div style={{ color: 'var(--exl-muted)', fontSize: '.78rem', textAlign: 'center', padding: '1.5rem 0' }}>No linked claims found for this garage or broker</div>
                )}
              </div>
              )
            })()}

            {/* AI Hint */}
            {revealedRedFlag && (
              <div className="ai-hint-box fade-up" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(155,114,248,.2)', border: '1.5px solid rgba(155,114,248,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>⚡</div>
                  <div>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 600, color: '#C4A9FF', fontSize: '.8rem', letterSpacing: '.1em', marginBottom: '.3rem' }}>AI INTELLIGENCE BRIEF</div>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.6, color: 'var(--exl-text)' }}>🔍 {revealedRedFlag}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Decision Panel */}
          <div style={{ position: 'relative' }}>
            <div className="g-card-accent" style={{ padding: '1.1rem', position: 'sticky', top: 0 }}>
              <div style={{ fontSize: '.68rem', color: 'var(--exl-orange)', letterSpacing: '.12em', fontWeight: 700, marginBottom: '.75rem', fontFamily: "'Oswald',sans-serif" }}>YOUR VERDICT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', marginBottom: '.8rem' }}>
                {[{ value: 'fraud', label: '🚨 FRAUDULENT', bg: 'rgba(240,80,80,.15)', bc: 'rgba(240,80,80,.6)', tc: '#F87171' }, { value: 'legitimate', label: '✅ LEGITIMATE', bg: 'rgba(34,208,122,.12)', bc: 'rgba(34,208,122,.5)', tc: '#22D07A' }].map(({ value, label, bg, bc, tc }) => (
                  <button key={value} className="exl-btn" onClick={() => { play('verdict'); onSetAnswer(value) }} style={{ width: '100%', padding: '.75rem', borderRadius: '9px', border: `2px solid ${playerAnswer === value ? bc : 'var(--exl-border)'}`, background: playerAnswer === value ? bg : 'rgba(255,255,255,.02)', color: playerAnswer === value ? tc : 'var(--exl-muted)', fontWeight: 700, fontSize: '.88rem', transition: 'all .18s', transform: playerAnswer === value ? 'scale(1.02)' : 'none' }}>{label}</button>
                ))}
              </div>

              {playerAnswer && <>
                <div className="divider" />
                <div style={{ marginBottom: '.75rem' }}>
                  <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', letterSpacing: '.09em', marginBottom: '.4rem', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>CONFIDENCE LEVEL</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.3rem' }}>
                    {['low', 'medium', 'high'].map(lvl => (
                      <button key={lvl} className="exl-btn" onClick={() => { play('conf'); onSetConfidence(lvl) }} style={{ padding: '.42rem', borderRadius: '8px', border: `1.5px solid ${confidence === lvl ? 'var(--exl-orange)' : 'var(--exl-border)'}`, background: confidence === lvl ? 'rgba(255,107,53,.14)' : 'transparent', color: confidence === lvl ? 'var(--exl-orange)' : 'var(--exl-muted)', fontSize: '.71rem', fontWeight: 700 }}>{lvl.toUpperCase()}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', marginTop: '.3rem' }}>High confidence = 1.5× if correct</div>
                </div>

                {currentRound >= 2 && (
                  <div style={{ marginBottom: '.75rem' }}>
                    <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', letterSpacing: '.09em', marginBottom: '.4rem', fontFamily: "'Oswald',sans-serif", fontWeight: 300 }}>FLAG INDICATORS <span style={{ color: 'var(--exl-orange)' }}>({selectedRedFlags.length}/3)</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                      {RED_FLAG_OPTIONS.map(flag => {
                        const active = selectedRedFlags.includes(flag)
                        const disabled = !active && selectedRedFlags.length >= 3
                        return (
                          <button key={flag} className="exl-btn" onClick={() => onToggleRedFlag(flag)} disabled={disabled} style={{ width: '100%', padding: '.38rem .65rem', borderRadius: '7px', textAlign: 'left', justifyContent: 'flex-start', gap: '.4rem', border: `1px solid ${active ? 'rgba(255,107,53,.5)' : 'var(--exl-border)'}`, background: active ? 'rgba(255,107,53,.1)' : 'transparent', color: active ? 'var(--exl-text)' : disabled ? 'var(--exl-muted)' : 'var(--exl-text-soft)', fontSize: '.73rem', opacity: disabled ? .4 : 1 }}>
                            <span style={{ color: active ? 'var(--exl-orange)' : 'var(--exl-border)', fontSize: '.62rem' }}>{active ? '◆' : '◇'}</span>{flag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button className="exl-btn exl-btn-primary" style={{ width: '100%', padding: '.8rem', fontSize: '.9rem' }} onClick={() => onSubmit(playerAnswer)}>Submit Verdict →</button>
              </>}

              <div className="divider" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.38rem' }}>
                {ROUND_META.map(({ round, name, icon }) => (
                  <div key={round} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <div className="round-dot" style={{ background: currentRound > round ? 'var(--green)' : currentRound === round ? 'var(--exl-orange)' : 'var(--exl-border)', color: '#fff', fontSize: currentRound > round ? '.58rem' : '.78rem' }}>{currentRound > round ? '✓' : icon}</div>
                    <span style={{ fontSize: '.78rem', color: currentRound >= round ? 'var(--exl-text)' : 'var(--exl-muted)', fontWeight: currentRound === round ? 600 : 400, flex: 1 }}>{name}</span>
                    {roundAnswers.find(r => r.round === round) && <span style={{ fontSize: '.7rem', color: 'var(--exl-muted)', fontStyle: 'italic' }}>done</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div className="photo-modal-overlay" onClick={() => setPhotoModal(null)}>
          <div className="photo-modal-inner" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '1rem' }}>📷 {photoModal.description}</div>
              <button style={{ background: 'none', border: 'none', color: 'var(--exl-muted)', fontSize: '1.4rem', cursor: 'pointer' }} onClick={() => setPhotoModal(null)}>×</button>
            </div>
            {photoModal.url ? (
              <img src={photoModal.url} alt={photoModal.description} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '10px', marginBottom: '1rem', background: 'var(--exl-surface2)', border: '1px solid var(--exl-border)' }} />
            ) : (
              <div style={{ background: 'var(--exl-surface2)', border: '1px solid var(--exl-border)', borderRadius: '10px', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: '4rem' }}>📷</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   REVEAL SCREEN
═══════════════════════════════════════════════════ */
const RevealScreen = ({ scenario, roundAnswers, playerName, onContinue }: { scenario: GameScenario; roundAnswers: RoundAnswer[]; playerName: string; onContinue: () => void }) => {
  const { play } = useContext(SoundCtx)
  const [revealed, setRevealed] = useState(false)
  const [phase, setPhase] = useState<'calculating' | 'counting' | 'done'>('calculating')
  const [displayScore, setDisplayScore] = useState(0)
  const scenarioScore = roundAnswers.reduce((s, r) => s + r.points, 0)

  useEffect(() => {
    const t1 = setTimeout(() => setRevealed(true), 400)
    const t2 = setTimeout(() => { setPhase('counting'); play('gameOver') }, 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'counting') return
    let start = 0
    const steps = 40; const inc = scenarioScore / steps
    const interval = setInterval(() => {
      start += inc
      if (start >= scenarioScore) { setDisplayScore(scenarioScore); setPhase('done'); play('coin'); clearInterval(interval) }
      else setDisplayScore(Math.floor(start))
    }, 35)
    return () => clearInterval(interval)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const playerGotItRight = roundAnswers.some(r => r.isCorrect)
  const isFraud = scenario.actualVerdict === 'fraud'
  const firstCorrectRound = roundAnswers.find(r => r.isCorrect)?.round

  const getVerdict = () => {
    if (!playerGotItRight) return { headline: 'The Algorithm Saw It Differently', sub: 'The AI identified patterns that human review initially missed.', color: 'rgba(240,80,80,.6)', bg: 'rgba(240,80,80,.08)' }
    // Player got it right AND the verdict was overridden (multi-agent evidence corrected the ML model)
    if (scenario.verdictOverridden && firstCorrectRound === 1) return { headline: 'You Beat the Algorithm!', sub: 'The ML model missed this, but you and the specialist agents caught it. Your human judgment outperformed the primary model.', color: '#C084FC', bg: 'rgba(192,132,252,.1)' }
    if (scenario.verdictOverridden) return { headline: 'Sharp Eye, Detective', sub: 'Multiple AI agents flagged this case — but the ML model missed it. You saw through the deception.', color: '#C084FC', bg: 'rgba(192,132,252,.08)' }
    if (firstCorrectRound === 1) return { headline: 'You Outpaced the AI', sub: 'Your instinct aligned with machine intelligence — before the algorithm had all the data.', color: 'rgba(34,208,122,.6)', bg: 'rgba(34,208,122,.07)' }
    if (firstCorrectRound && firstCorrectRound <= 2) return { headline: 'Solid Investigative Instinct', sub: "Your assessment matched the AI's conclusion with limited evidence in hand.", color: 'rgba(34,208,122,.5)', bg: 'rgba(34,208,122,.06)' }
    return { headline: 'Your Instinct Aligns With Machine Intelligence', sub: "You reached the same conclusion as EXL's AI agents — with deeper evidence review.", color: 'rgba(255,107,53,.5)', bg: 'rgba(255,107,53,.07)' }
  }
  const vd = getVerdict()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 'clamp(.75rem,1.5vh,1.5rem) clamp(1rem,2vw,2rem)', background: 'var(--exl-bg)', position: 'relative' }}>
      <div style={{ maxWidth: '1060px', margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {(phase === 'calculating' || phase === 'counting') && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(4,5,10,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)' }}>
            {phase === 'calculating' && (
              <div style={{ textAlign: 'center' }}>
                <div className="pulse2" style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.85rem', letterSpacing: '.25em', color: 'var(--exl-orange)', marginBottom: '1.5rem' }}>CALCULATING CASE SCORE…</div>
                <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center' }}>{[0, 1, 2].map(i => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--exl-orange)', animation: `pulse2 1.2s ${i * .2}s ease infinite` }} />)}</div>
              </div>
            )}
            {phase === 'counting' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.85rem', letterSpacing: '.25em', color: 'var(--exl-muted)', marginBottom: '1rem' }}>CASE SCORE</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '7rem', lineHeight: 1, background: 'linear-gradient(135deg,#fff,var(--exl-orange))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{displayScore.toLocaleString()}</div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.75rem', letterSpacing: '.2em', color: 'var(--exl-muted)', marginTop: '.5rem' }}>POINTS</div>
              </div>
            )}
          </div>
        )}

        <div className="scale-in" style={{ border: `1.5px solid ${vd.color}`, background: vd.bg, borderRadius: '14px', padding: 'clamp(.75rem,1.5vh,1.25rem) clamp(1rem,2vw,2rem)', textAlign: 'center', marginBottom: 'clamp(.6rem,1.2vh,1rem)', flexShrink: 0 }}>
          <div style={{ fontSize: 'clamp(1.5rem,3vh,2.5rem)', marginBottom: '.3rem' }}>{playerGotItRight ? '🎯' : '🧠'}</div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.4rem,3vw,2.2rem)', letterSpacing: '.06em', marginBottom: '.2rem' }}>{vd.headline}</h1>
          <p style={{ color: 'var(--exl-text-soft)', fontSize: 'clamp(.75rem,1.5vh,.88rem)', maxWidth: '520px', margin: '0 auto' }}>{vd.sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(.6rem,1vw,1rem)', marginBottom: 'clamp(.5rem,1vh,.8rem)' }}>
          <div className="g-card" style={{ padding: 'clamp(.75rem,1.5vh,1.1rem)', border: '1.5px solid rgba(155,114,248,.35)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--purple)', letterSpacing: '.14em', fontWeight: 700, marginBottom: '.8rem', fontFamily: "'Oswald',sans-serif" }}>YOUR INVESTIGATION — DET. {playerName.toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {roundAnswers.map(ans => (
                <div key={ans.round} style={{ background: 'rgba(155,114,248,.07)', borderRadius: '8px', padding: 'clamp(.35rem,.7vh,.55rem) .7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.78rem', marginBottom: '.1rem' }}>Round {ans.round}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--exl-muted)' }}>{ans.answer === 'fraud' ? '🚨 Fraud' : ans.answer === 'legitimate' ? '✅ Legitimate' : '⏱ No Answer'}{ans.answer !== 'no-answer' && ` · ${ans.confidence}`}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.9rem', fontWeight: 700, color: ans.isCorrect ? 'var(--green)' : 'var(--red)' }}>{ans.isCorrect ? '✓' : '✗'}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--purple)', fontWeight: 700 }}>+{ans.points}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid var(--exl-border)', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '.82rem' }}>Score This Case</span>
              {phase === 'done' ? <span className="score-reveal-anim" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.3rem,2.5vh,1.8rem)', letterSpacing: '.04em', color: 'var(--purple)' }}>{scenarioScore.toLocaleString()}</span> : <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.3rem,2.5vh,1.8rem)', color: 'var(--exl-muted)' }}>—</span>}
            </div>
          </div>

          <div className={`g-card ai-scan ${revealed ? 'reveal-glow' : ''}`} style={{ padding: 'clamp(.75rem,1.5vh,1.25rem)', border: `1.5px solid ${isFraud ? 'rgba(240,80,80,.4)' : 'rgba(34,208,122,.35)'}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '.65rem', color: isFraud ? 'var(--red)' : 'var(--green)', letterSpacing: '.14em', fontWeight: 700, marginBottom: '.5rem', fontFamily: "'Oswald',sans-serif", flexShrink: 0 }}>EXL AI LAB ANALYSIS</div>
            {scenario.verdictOverridden && (
              <div style={{ background: 'rgba(192,132,252,.1)', border: '1px solid rgba(192,132,252,.3)', borderRadius: '8px', padding: '.4rem .65rem', marginBottom: '.5rem', fontSize: '.7rem', color: '#C084FC', lineHeight: 1.4, flexShrink: 0 }}>
                The ML model classified this as legitimate, but specialist agents detected critical fraud indicators that overruled the primary model.
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(.4rem,.8vh,.75rem)', flexShrink: 0 }}>
              <div style={{ fontSize: '.65rem', color: 'var(--exl-muted)', letterSpacing: '.1em', marginBottom: '.2rem' }}>{isFraud ? 'FRAUD RISK SCORE' : 'LEGITIMACY CONFIDENCE'}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontWeight: 400, fontSize: 'clamp(2rem,4vh,3.5rem)', lineHeight: 1, marginBottom: '.3rem', color: isFraud ? '#F87171' : '#22D07A' }}>{isFraud ? scenario.fraudScore : (100 - scenario.fraudScore)}</div>
              <span className="badge" style={{ background: isFraud ? 'rgba(240,80,80,.18)' : 'rgba(34,208,122,.13)', color: isFraud ? '#F87171' : '#22D07A', border: `1px solid ${isFraud ? 'rgba(240,80,80,.4)' : 'rgba(34,208,122,.3)'}`, fontSize: '.75rem', padding: '.22rem .75rem' }}>{isFraud ? '🚨 FRAUDULENT' : '✅ LEGITIMATE'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {Object.entries(scenario.aiAgentFindings).map(([agent, data]) => {
                const ds = isFraud ? data.score : (100 - data.score)
                const barColor = isFraud ? (data.score > 70 ? 'linear-gradient(90deg,#F05050,#FF6B35)' : data.score > 40 ? 'linear-gradient(90deg,#FBBF24,#F59E0B)' : 'linear-gradient(90deg,#22D07A,#059669)') : 'linear-gradient(90deg,#22D07A,#16A34A)'
                return (
                  <div key={agent} style={{ background: 'var(--exl-surface2)', borderRadius: '8px', padding: '.55rem .75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.3rem' }}>
                      <span style={{ fontSize: '.72rem', color: 'var(--exl-muted)' }}>{camelLabel(agent)}</span>
                      <span style={{ fontWeight: 700, fontSize: '.72rem', color: isFraud ? 'var(--exl-orange)' : 'var(--green)' }}>{ds}%</span>
                    </div>
                    <div className="gauge-track" style={{ marginBottom: '.28rem' }}><div className="gauge-fill" style={{ width: revealed ? `${ds}%` : '0%', background: barColor }} /></div>
                    <div style={{ fontSize: '.7rem', color: 'var(--exl-text-soft)', lineHeight: 1.4 }}>{data.finding}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {scenario.redFlags.length > 0 && (
          <div className="g-card" style={{ padding: 'clamp(.6rem,1vh,.9rem) clamp(.75rem,1.5vw,1.2rem)', marginBottom: 'clamp(.4rem,.8vh,.8rem)', border: '1.5px solid rgba(251,146,60,.25)', flexShrink: 0 }}>
            <div style={{ fontSize: '.65rem', color: '#FB923C', letterSpacing: '.14em', fontWeight: 700, marginBottom: '.5rem', fontFamily: "'Oswald',sans-serif" }}>AI-IDENTIFIED RED FLAGS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '.35rem' }}>
              {scenario.redFlags.map((flag, i) => (
                <div key={i} style={{ background: 'rgba(251,146,60,.06)', border: '1px solid rgba(251,146,60,.2)', borderRadius: '7px', padding: '.4rem .7rem', display: 'flex', gap: '.4rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#FBBF24', fontSize: '.8rem', marginTop: '.02rem' }}>⚠</span>
                  <span style={{ fontSize: '.75rem', lineHeight: 1.45 }}>{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', flexShrink: 0, paddingTop: 'clamp(.3rem,.5vh,.5rem)' }}>
          <button className="exl-btn exl-btn-primary" style={{ fontSize: 'clamp(.85rem,1.5vh,1rem)', padding: 'clamp(.6rem,1.2vh,1rem) 2.5rem' }} onClick={() => { play('click'); onContinue() }}>View Leaderboard →</button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   LEADERBOARD SCREEN
═══════════════════════════════════════════════════ */
const LeaderboardScreen = ({ playerName, finalScore, leaderboard, onPlayAnother, onRestart }: { playerName: string; finalScore: number; leaderboard: LeaderboardEntry[]; onPlayAnother: () => void; onRestart: () => void }) => {
  const { play } = useContext(SoundCtx)
  const playerRank = leaderboard.findIndex(e => e.player_name === playerName && e.score === finalScore) + 1
  const title = getTitle(finalScore)
  const medal = (i: number) => i === 0 ? { bg: '#F5C842', tc: '#3B2900', icon: '🥇' } : i === 1 ? { bg: '#8A9AB0', tc: '#1A2030', icon: '🥈' } : i === 2 ? { bg: '#CD7C4A', tc: '#2A1500', icon: '🥉' } : { bg: 'var(--exl-border)', tc: 'var(--exl-muted)', icon: '' }

  useEffect(() => { play('reveal') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--exl-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(1.5rem,2.5vw,2.5rem) clamp(1.5rem,3vh,3rem) clamp(2rem,4vw,4rem)', borderRight: '1px solid var(--exl-border)', position: 'relative' }}>
        <div style={{ opacity: .5, marginBottom: 'clamp(1rem,2vh,2rem)' }}><EXLLogo size="sm" /></div>
        <div style={{ marginBottom: 'clamp(1rem,2vh,2rem)' }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.78rem', letterSpacing: '.2em', color: 'var(--exl-orange)', marginBottom: '.4rem', fontWeight: 300 }}>INVESTIGATION CLOSED</div>
          <h1 className="title-main" style={{ fontSize: 'clamp(2.5rem,5vw,5rem)' }}>{title}</h1>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.8rem', letterSpacing: '.12em', color: 'var(--exl-muted)', fontWeight: 300, marginTop: '.3rem' }}>FILED BY DET. {playerName.toUpperCase()}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'clamp(.5rem,1vw,.75rem)', marginBottom: 'clamp(1.5rem,3vh,2.5rem)' }}>
          {[{ label: 'FINAL SCORE', val: finalScore.toLocaleString(), accent: 'var(--exl-orange)' }, { label: 'RANK', val: `#${playerRank}`, accent: '#F5C842' }, { label: 'TITLE', val: title, accent: '#22D07A' }].map(({ label, val, accent }) => (
            <div key={label} className="scale-in" style={{ background: 'var(--exl-surface)', border: '1px solid var(--exl-border)', borderRadius: '12px', padding: 'clamp(.7rem,1.5vh,1.1rem) .9rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.6rem', color: accent, letterSpacing: '.14em', fontFamily: "'Oswald',sans-serif", fontWeight: 400, marginBottom: '.3rem' }}>{label}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.1rem,2vh,1.4rem)', letterSpacing: '.04em', color: accent }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <button className="exl-btn exl-btn-primary" style={{ padding: 'clamp(.7rem,1.2vh,.95rem) 1.8rem', fontSize: '.9rem' }} onClick={() => { play('click'); onPlayAnother() }}>Investigate Another Case</button>
          <button className="exl-btn exl-btn-ghost" style={{ padding: 'clamp(.6rem,1vh,.85rem) 1.4rem', fontSize: '.88rem' }} onClick={() => { play('click'); onRestart() }}>Start Over</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(1.5rem,3vh,3rem) clamp(1.5rem,2.5vw,3rem) clamp(1.5rem,3vh,3rem) clamp(1.5rem,2vw,2.5rem)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--exl-border) 1px,transparent 1px)', backgroundSize: '100% 52px', opacity: .25 }} />
        <div style={{ position: 'relative', zIndex: 1, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '.78rem', letterSpacing: '.2em', color: 'var(--exl-orange)', fontWeight: 300, marginBottom: 'clamp(.75rem,1.5vh,1.25rem)', flexShrink: 0 }}>INVESTIGATION LEDGER — TOP DETECTIVES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {leaderboard.map((e, i) => {
              const isPlayer = e.player_name === playerName && e.score === finalScore
              const m = medal(i)
              return (
                <div key={i} className={`lb-row ${i === 0 ? 'lb-tier-1' : i === 1 ? 'lb-tier-2' : i === 2 ? 'lb-tier-3' : ''}`} style={{ border: `1px solid ${isPlayer ? 'rgba(255,107,53,.55)' : 'var(--exl-border)'}`, background: isPlayer ? 'rgba(255,107,53,.08)' : undefined, transform: isPlayer ? 'scale(1.015)' : 'none', transition: 'transform .2s', borderRadius: '11px', padding: 'clamp(.45rem,.9vh,.7rem) clamp(.65rem,1vw,1rem)', flexShrink: 0 }}>
                  <div style={{ width: 'clamp(26px,3vh,32px)', height: 'clamp(26px,3vh,32px)', borderRadius: '50%', background: m.bg, color: m.tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.75rem', flexShrink: 0 }}>{m.icon || (i + 1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', color: isPlayer ? 'var(--exl-orange)' : 'var(--exl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.player_name}{isPlayer ? ' ← YOU' : ''}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--exl-muted)', fontFamily: "'Oswald',sans-serif", fontWeight: 300, letterSpacing: '.06em' }}>{e.title}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1rem,2vh,1.3rem)', letterSpacing: '.04em', color: isPlayer ? 'var(--exl-orange)' : i === 0 ? '#F5C842' : 'var(--exl-text)', flexShrink: 0 }}>{e.score.toLocaleString()}</div>
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 'clamp(.75rem,1.5vh,2rem)', fontSize: '.68rem', color: 'var(--exl-muted)', letterSpacing: '.1em', fontFamily: "'Oswald',sans-serif", fontWeight: 300, flexShrink: 0 }}>EXL AI CLAIMS INTELLIGENCE · SIMULATION ENGINE</div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   ROOT GAME COMPONENT
═══════════════════════════════════════════════════ */
export default function GamePage({ onBack }: GamePageProps) {
  const [scenarios, setScenarios] = useState<GameScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [musicVol, setMusicVol] = useState(0.35)

  const [phase, setPhase] = useState<'welcome' | 'name-entry' | 'case-selection' | 'game' | 'reveal' | 'leaderboard'>('welcome')
  const [playerName, setPlayerName] = useState('')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentRound, setCurrentRound] = useState(1)
  const [playerAnswer, setPlayerAnswer] = useState<string | null>(null)
  const [confidence, setConfidence] = useState('medium')
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(60)
  const [timerActive, setTimerActive] = useState(false)
  const [roundAnswers, setRoundAnswers] = useState<RoundAnswer[]>([])
  const [lifelineUsed, setLifelineUsed] = useState(false)
  const [revealedRedFlag, setRevealedRedFlag] = useState<string | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const prevRound = useRef(1)
  const bgMusic = useRef(new AmbientMusic())

  const play = useCallback((name: string) => {
    if (!soundOn) return
    SOUNDS[name]?.()
    // Start bg music on first user gesture (Chrome autoplay policy)
    if (!bgMusic.current.isPlaying) bgMusic.current.start()
  }, [soundOn])

  // Stop bg music when sound toggled off; cleanup on unmount
  useEffect(() => {
    if (!soundOn && bgMusic.current.isPlaying) bgMusic.current.stop()
    return () => { bgMusic.current.stop() }
  }, [soundOn])

  // Fetch scenarios and leaderboard from API
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/game/scenarios`).then(r => r.json()).catch(() => []),
      fetchLeaderboard(),
    ]).then(([scenarioData, lbData]) => {
      setScenarios(Array.isArray(scenarioData) ? scenarioData : [])
      setLeaderboard(lbData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Post leaderboard to server
  const postLeaderboard = useCallback(async (name: string, score: number, casesPlayed: number, accuracy: number) => {
    try { await fetch(`${API_BASE_URL}/api/game/leaderboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score, casesPlayed, accuracy }) }) } catch { /* ignore */ }
  }, [])

  const scenario = selectedIdx !== null ? scenarios[selectedIdx] : null

  // Exhibit unlock sound
  useEffect(() => {
    if (phase === 'game' && currentRound !== prevRound.current) {
      prevRound.current = currentRound
      play('roundStart')
    }
  }, [currentRound, phase, play])

  // Timer
  useEffect(() => {
    if (!timerActive) return
    if (timeLeft <= 0) { handleTimeUp(); return }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, timerActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetGameState = () => {
    setCurrentRound(1); setPlayerAnswer(null); setConfidence('medium')
    setSelectedRedFlags([]); setTimeLeft(60); setTimerActive(false)
    setRoundAnswers([]); setLifelineUsed(false); setRevealedRedFlag(null); setFinalScore(0)
    prevRound.current = 1
  }

  const handleStartGame = (idx: number) => {
    resetGameState(); setSelectedIdx(idx); setTimerActive(true); setPhase('game'); play('caseStart')
  }

  const handleTimeUp = () => { setTimerActive(false); handleSubmitAnswer('no-answer') }

  const handleSubmitAnswer = (answer: string) => {
    setTimerActive(false)
    const sc = scenarios[selectedIdx!]
    const isCorrect = answer === sc.actualVerdict
    let points = 0
    if (answer !== 'no-answer') {
      if (isCorrect) {
        const base = ({ 1: 1000, 2: 750, 3: 500, 4: 300 } as Record<number, number>)[currentRound]
        const mult = ({ high: 1.5, medium: 1.2, low: 1.0 } as Record<string, number>)[confidence]
        points = Math.round(base * mult)
        const cf = selectedRedFlags.filter(f => sc.redFlags.includes(f)).length
        points += cf * 200
        const spent = 60 - timeLeft
        if (spent < 90) points += 250; else if (spent < 120) points += 150
        if (lifelineUsed) points -= 200
      } else {
        points = Math.round(100 * (confidence === 'high' ? 0.5 : 0.8))
      }
    }
    play(isCorrect ? 'correct' : 'wrong')
    const newRA = [...roundAnswers, { round: currentRound, answer, confidence, points, isCorrect, timeSpent: 60 - timeLeft }]
    setRoundAnswers(newRA)

    if (currentRound < 4) {
      setCurrentRound(r => r + 1)
      setPlayerAnswer(null); setConfidence('medium')
      setSelectedRedFlags([]); setTimeLeft(60); setTimerActive(true)
    } else {
      const score = newRA.reduce((s, r) => s + r.points, 0)
      setFinalScore(score)
      const correctCount = newRA.filter(r => r.isCorrect).length
      postLeaderboard(playerName, score, 1, correctCount / 4).then(() => {
        fetchLeaderboard().then(lb => setLeaderboard(lb))
      })
      // Clear saved session since game is complete
      fetch(`${API_BASE_URL}/api/game/session/${encodeURIComponent(playerName)}`, { method: 'DELETE' }).catch(() => {})
      setPhase('reveal')
    }
  }

  const handleLifeline = () => {
    if (lifelineUsed || !scenario?.redFlags.length) return
    setLifelineUsed(true)
    setRevealedRedFlag(scenario.redFlags[Math.floor(Math.random() * scenario.redFlags.length)])
  }

  const handleToggleRedFlag = (flag: string) => {
    if (selectedRedFlags.includes(flag)) setSelectedRedFlags(p => p.filter(f => f !== flag))
    else if (selectedRedFlags.length < 3) setSelectedRedFlags(p => [...p, flag])
  }

  const handleExitSave = async () => {
    setTimerActive(false)
    try {
      await fetch(`${API_BASE_URL}/api/game/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          scenario_id: scenario?.id ?? 0,
          current_round: currentRound,
          round_answers: roundAnswers,
          time_left: timeLeft,
          total_score: roundAnswers.reduce((s, r) => s + r.points, 0),
          lifeline_used: lifelineUsed,
        }),
      })
    } catch { /* ignore */ }
    resetGameState()
    setPlayerName('')
    setSelectedIdx(null)
    setPhase('welcome')
  }

  const handlePlayAnother = () => {
    // Clear completed session
    if (playerName) fetch(`${API_BASE_URL}/api/game/session/${encodeURIComponent(playerName)}`, { method: 'DELETE' }).catch(() => {})
    resetGameState(); setPhase('case-selection')
  }
  const handleRestart = () => {
    if (playerName) fetch(`${API_BASE_URL}/api/game/session/${encodeURIComponent(playerName)}`, { method: 'DELETE' }).catch(() => {})
    resetGameState(); setPlayerName(''); setSelectedIdx(null); setPhase('welcome')
  }

  // Loading state
  if (loading) {
    return (
      <div className="game-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse2" style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1rem', letterSpacing: '.25em', color: 'var(--exl-orange)', marginBottom: '1rem' }}>LOADING CASE FILES…</div>
          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center' }}>{[0, 1, 2].map(i => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--exl-orange)', animation: `pulse2 1.2s ${i * .2}s ease infinite` }} />)}</div>
        </div>
      </div>
    )
  }

  // No scenarios
  if (!loading && scenarios.length === 0) {
    return (
      <div className="game-root" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <EXLLogo size="lg" />
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.5rem', letterSpacing: '.06em', marginTop: '2rem', marginBottom: '1rem' }}>No Cases Available</h2>
          <p style={{ color: 'var(--exl-muted)', fontSize: '.95rem', marginBottom: '2rem', lineHeight: 1.6 }}>The administrator has not yet selected any cases for the game. Please check back later or contact your admin.</p>
          <button className="exl-btn exl-btn-ghost" style={{ padding: '.85rem 2rem', fontSize: '.95rem' }} onClick={onBack}>← Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <SoundCtx.Provider value={{ play, soundOn }}>
      <div className="game-root">
        {/* Sound toggle + volume */}
        {phase !== 'game' && (
          <div className="sound-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div onClick={() => setSoundOn(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <span style={{ fontSize: '.85rem' }}>{soundOn ? '🔊' : '🔇'}</span>
              <span>{soundOn ? 'SOUND ON' : 'SOUND OFF'}</span>
            </div>
            {soundOn && (
              <input type="range" min="0" max="100" value={Math.round(musicVol * 100)}
                onChange={e => { const v = parseInt(e.target.value) / 100; setMusicVol(v); bgMusic.current.setVolume(v) }}
                onClick={e => e.stopPropagation()}
                style={{ width: '60px', height: '3px', accentColor: '#FF6B35', cursor: 'pointer' }}
                title={`Music: ${Math.round(musicVol * 100)}%`}
              />
            )}
          </div>
        )}

        {phase === 'welcome' && <WelcomeScreen onNext={() => { play('click'); setPhase('name-entry') }} leaderboard={leaderboard} />}
        {phase === 'name-entry' && <NameEntry onStart={n => { setPlayerName(n); setPhase('case-selection') }} onResume={(n, session) => {
          setPlayerName(n)
          // Find the scenario by ID
          const idx = scenarios.findIndex(s => s.id === session.scenario_id)
          if (idx === -1) { setPhase('case-selection'); return }
          setSelectedIdx(idx)
          setCurrentRound(session.current_round)
          setRoundAnswers(session.round_answers)
          setLifelineUsed(session.lifeline_used)
          setTimeLeft(session.time_left)
          setFinalScore(session.total_score)
          setTimerActive(true)
          setPhase('game')
        }} />}
        {phase === 'case-selection' && <CaseSelection playerName={playerName} scenarios={scenarios} onSelect={handleStartGame} />}
        {phase === 'game' && scenario && (
          <GameScreen
            playerName={playerName} scenario={scenario} currentRound={currentRound}
            timeLeft={timeLeft} playerAnswer={playerAnswer} confidence={confidence}
            selectedRedFlags={selectedRedFlags} lifelineUsed={lifelineUsed}
            revealedRedFlag={revealedRedFlag} roundAnswers={roundAnswers}
            onSetAnswer={setPlayerAnswer} onSetConfidence={setConfidence}
            onToggleRedFlag={handleToggleRedFlag} onSubmit={handleSubmitAnswer} onLifeline={handleLifeline} onExitSave={handleExitSave}
          />
        )}
        {phase === 'reveal' && scenario && <RevealScreen scenario={scenario} roundAnswers={roundAnswers} playerName={playerName} onContinue={() => setPhase('leaderboard')} />}
        {phase === 'leaderboard' && <LeaderboardScreen playerName={playerName} finalScore={finalScore} leaderboard={leaderboard} onPlayAnother={handlePlayAnother} onRestart={handleRestart} />}
      </div>
    </SoundCtx.Provider>
  )
}
