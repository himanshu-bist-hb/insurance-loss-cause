/**
 * ImageGamePage — "Image Detective" quick game
 * Players classify claim images as Real or AI Edited/Generated.
 * Features: live leaderboard, timer, streak bonuses, sound effects, SVG-only icons.
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from 'react'
import detectiveThemeUrl from '../assets/audio/detective-theme.mp3'
import carEngineUrl from '../assets/audio/car-engine.mp3'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { QRCodeSVG } from 'qrcode.react'
import { API_BASE_URL } from '../config'

/* ═══════════════════════════════════════════════════
   SOUND SYSTEM (Web Audio API — same pattern as GamePage)
═══════════════════════════════════════════════════ */
const SoundCtx = createContext<{ play: (n: string) => void; soundOn: boolean }>({ play: () => { }, soundOn: true })

const makeTone = (freq: number, type: OscillatorType = 'sine', dur = 0.12, gain = 0.15) => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur)
    setTimeout(() => ctx.close(), (dur + 0.1) * 1000)
  } catch { /* ignore */ }
}

const SOUNDS: Record<string, () => void> = {
  click: () => makeTone(880, 'sine', 0.08, 0.12),
  correct: () => { makeTone(523, 'sine', 0.1, 0.1); setTimeout(() => makeTone(659, 'sine', 0.1, 0.1), 80); setTimeout(() => makeTone(784, 'sine', 0.15, 0.12), 160) },
  wrong: () => { makeTone(200, 'sawtooth', 0.15, 0.08); setTimeout(() => makeTone(180, 'sawtooth', 0.2, 0.06), 100) },
  streak: () => { [0, 50, 100, 150].forEach((d, i) => setTimeout(() => makeTone(440 + i * 110, 'triangle', 0.1, 0.1), d)) },
  tick: () => makeTone(1000, 'sine', 0.03, 0.05),
  coin: () => { [0, 60, 120].forEach((d, i) => setTimeout(() => makeTone(800 + i * 200, 'triangle', .1, .1), d)) },
  reveal: () => { [0, 80, 160, 240].forEach((d, i) => setTimeout(() => makeTone(220 + i * 110, 'sine', .15, .12), d)) },
  speedBonus: () => { [0, 50, 100].forEach((d, i) => setTimeout(() => makeTone(700 + i * 200, 'triangle', 0.08, 0.1), d)) },
  gameOver: () => { [0, 100, 200, 300, 450].forEach((d, i) => setTimeout(() => makeTone([523, 659, 784, 880, 1047][i], 'sine', 0.18, 0.12), d)) },
  newImage: () => makeTone(600, 'sine', 0.04, 0.06),
  streakBreak: () => { makeTone(500, 'triangle', 0.12, 0.07); setTimeout(() => makeTone(300, 'triangle', 0.18, 0.05), 80) },
  lastImage: () => { makeTone(800, 'sine', 0.06, 0.08); setTimeout(() => makeTone(800, 'sine', 0.06, 0.08), 120) },
  perfect: () => { [0, 80, 160, 240, 350].forEach((d, i) => setTimeout(() => makeTone([523, 659, 784, 1047, 1318][i], 'sine', 0.2, 0.13), d)) },
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
   CONSTANTS
═══════════════════════════════════════════════════ */
const TIME_PER_IMAGE = 10
const BASE_POINTS = 100
const SPEED_BONUS_MAX = 50
const STREAK_BONUS = 25
const WRONG_PENALTY = -10

const ORANGE = '#FF6B35'

const getRankTitle = (s: number) =>
  s >= 2000 ? 'Master Analyst' : s >= 1500 ? 'Senior Analyst' : s >= 1000 ? 'Analyst' : s >= 500 ? 'Trainee' : 'Rookie'

const calcPoints = (correct: boolean, elapsed: number, streak: number) => {
  if (!correct) return WRONG_PENALTY
  const speed = Math.max(0, Math.round(SPEED_BONUS_MAX * (1 - elapsed / TIME_PER_IMAGE)))
  return BASE_POINTS + speed + streak * STREAK_BONUS
}

const LABEL_META: Record<string, { name: string; color: string; bg: string; border: string }> = {
  real: { name: 'Real', color: '#22D07A', bg: 'rgba(34,208,122,.12)', border: 'rgba(34,208,122,.4)' },
  ai: { name: 'AI Edited / Generated', color: '#F87171', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.4)' },
}

/* ═══════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════ */
const CameraIcon = ({ s = 24, c = 'currentColor' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
)

const ShieldIcon = ({ s = 16, c = '#22D07A' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
)

const PencilIcon = ({ s = 16, c = '#FBBF24' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const SparklesIcon = ({ s = 16, c = '#F87171' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.09 3.26L16 6l-2.91.74L12 10l-1.09-3.26L8 6l2.91-.74L12 2z" />
    <path d="M5 15l.55 1.64L7 17.18l-1.45.37L5 19.18l-.55-1.63L3 17.18l1.45-.37L5 15z" />
    <path d="M19 11l.55 1.64L21 13.18l-1.45.37L19 15.18l-.55-1.63L17 13.18l1.45-.37L19 11z" />
  </svg>
)

const TrophyIcon = ({ s = 16, c = 'currentColor' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
    <path d="M18 2H6v7a6 6 0 0012 0V2z" />
  </svg>
)

const ClockIcon = ({ s = 16, c = 'currentColor' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)

const FireIcon = ({ s = 14, c = '#FF6B35' }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
  </svg>
)

const CheckIcon = ({ s = 32 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#22D07A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const XIcon = ({ s = 32 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SpeakerIcon = ({ on, s = 18 }: { on: boolean; s?: number }) => on ? (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
  </svg>
) : (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
  </svg>
)

const ArrowLeftIcon = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
)

/* ═══════════════════════════════════════════════════
   3D WIREFRAME HERO — Real high-poly car via Three.js
   Loads ferrari.glb (DRACO compressed) from the JS-3D-Car
   repo and renders as neon wireframe with scan effects.
═══════════════════════════════════════════════════ */
/* ── Color presets for mesh selector ── */
const MESH_COLORS = [
  { name: 'Neon Green', primary: '#60ff40', dim: '#40b030', glass: '#50d0ff', grid: '#1a5010', gridDim: '#0d3008', particle: '#60ff40', hud: 'rgba(96,255,64,' },
  { name: 'Cyber Blue', primary: '#40b0ff', dim: '#2870b0', glass: '#80d8ff', grid: '#0a2a50', gridDim: '#051828', particle: '#40b0ff', hud: 'rgba(64,176,255,' },
  { name: 'Hot Pink', primary: '#ff40a0', dim: '#b03070', glass: '#ff80d0', grid: '#4a0a2a', gridDim: '#280518', particle: '#ff40a0', hud: 'rgba(255,64,160,' },
  { name: 'Gold', primary: '#ffc040', dim: '#b08020', glass: '#ffe080', grid: '#4a3a0a', gridDim: '#282008', particle: '#ffc040', hud: 'rgba(255,192,64,' },
  { name: 'Red Alert', primary: '#ff4040', dim: '#b02020', glass: '#ff8080', grid: '#4a0a0a', gridDim: '#280505', particle: '#ff4040', hud: 'rgba(255,64,64,' },
  { name: 'Purple', primary: '#a060ff', dim: '#6030b0', glass: '#c090ff', grid: '#200a4a', gridDim: '#120528', particle: '#a060ff', hud: 'rgba(160,96,255,' },
  { name: 'Aqua', primary: '#00ffcc', dim: '#00b08a', glass: '#66ffd9', grid: '#004a3a', gridDim: '#002820', particle: '#00ffcc', hud: 'rgba(0,255,204,' },
  { name: 'Electric Orange', primary: '#ff6a00', dim: '#b04a00', glass: '#ff9540', grid: '#4a2000', gridDim: '#281200', particle: '#ff6a00', hud: 'rgba(255,106,0,' },
  { name: 'Ice White', primary: '#e0f0ff', dim: '#90a8c0', glass: '#ffffff', grid: '#1a2030', gridDim: '#0d1420', particle: '#e0f0ff', hud: 'rgba(224,240,255,' },
  { name: 'Lime', primary: '#c0ff00', dim: '#80b000', glass: '#d8ff60', grid: '#2a3a00', gridDim: '#182000', particle: '#c0ff00', hud: 'rgba(192,255,0,' },
  { name: 'Magenta', primary: '#ff00ff', dim: '#b000b0', glass: '#ff66ff', grid: '#3a003a', gridDim: '#200020', particle: '#ff00ff', hud: 'rgba(255,0,255,' },
  { name: 'Coral', primary: '#ff6b6b', dim: '#c04848', glass: '#ff9e9e', grid: '#3a1515', gridDim: '#200a0a', particle: '#ff6b6b', hud: 'rgba(255,107,107,' },
  { name: 'Cyan', primary: '#00e5ff', dim: '#009eb0', glass: '#66f0ff', grid: '#003840', gridDim: '#002028', particle: '#00e5ff', hud: 'rgba(0,229,255,' },
  { name: 'Sunset Rose', primary: '#ff4f81', dim: '#c03060', glass: '#ff80a8', grid: '#3a0a20', gridDim: '#200510', particle: '#ff4f81', hud: 'rgba(255,79,129,' },
]

type PartColors = { body: number; tire: number; rim: number; light: number; seat: number }

const WireframeHero = ({ partColors }: { partColors: PartColors }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const materialsRef = useRef<{ body: THREE.ShaderMaterial; tire: THREE.ShaderMaterial; rim: THREE.ShaderMaterial; light: THREE.ShaderMaterial; seat: THREE.ShaderMaterial; glass: THREE.MeshBasicMaterial; grid1: THREE.Material; grid2: THREE.Material; particle: THREE.PointsMaterial } | null>(null)
  const hudColorRef = useRef(MESH_COLORS[0].hud)

  // Update materials when any part color changes
  useEffect(() => {
    hudColorRef.current = (MESH_COLORS[partColors.body] || MESH_COLORS[0]).hud
    if (!materialsRef.current) return
    const m = materialsRef.current
    m.body.uniforms.uBaseColor.value.set((MESH_COLORS[partColors.body] || MESH_COLORS[0]).primary)
    m.tire.uniforms.uBaseColor.value.set((MESH_COLORS[partColors.tire] || MESH_COLORS[0]).primary)
    m.rim.uniforms.uBaseColor.value.set((MESH_COLORS[partColors.rim] || MESH_COLORS[0]).primary)
    m.light.uniforms.uBaseColor.value.set((MESH_COLORS[partColors.light] || MESH_COLORS[0]).primary)
    m.seat.uniforms.uBaseColor.value.set((MESH_COLORS[partColors.seat] || MESH_COLORS[0]).primary)
    m.glass.color.set((MESH_COLORS[partColors.body] || MESH_COLORS[0]).glass)
    const bc = MESH_COLORS[partColors.body] || MESH_COLORS[0]
    if ((m.grid1 as THREE.MeshBasicMaterial).color) (m.grid1 as THREE.MeshBasicMaterial).color.set(bc.grid)
    if ((m.grid2 as THREE.MeshBasicMaterial).color) (m.grid2 as THREE.MeshBasicMaterial).color.set(bc.gridDim)
    m.particle.color.set(bc.particle)
  }, [partColors])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const bc = MESH_COLORS[partColors.body] || MESH_COLORS[0]

    // ── Scene ──
    const scene = new THREE.Scene()

    // ── Camera ── widen FOV + push back on small screens so the full car is visible
    const isMobile = window.innerWidth < 768
    const fov = isMobile ? 60 : 25
    const camera = new THREE.PerspectiveCamera(fov, el.clientWidth / el.clientHeight, 0.01, 1000)
    camera.position.set(7.2, isMobile ? 14 : 8.4, 24)
    camera.lookAt(0, 0, 0)

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // ── Wireframe materials (per part) with scan-reactive color blending ──
    const scanReactiveVert = `varying vec3 vWorldPos; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`
    const scanReactiveFrag = `uniform vec3 uBaseColor; uniform vec3 uScanColor; uniform vec3 uScanWorldPos; uniform vec3 uScanDir; uniform float uScanWidth; uniform float uOpacity; varying vec3 vWorldPos; void main(){ float proj = dot(vWorldPos - uScanWorldPos, uScanDir); float blend = 1.0 - smoothstep(0.0, uScanWidth, abs(proj)); vec3 col = mix(uBaseColor, uScanColor, blend * 0.7); gl_FragColor = vec4(col, uOpacity); }`
    const makeScanMat = (color: string, opacity: number) => new THREE.ShaderMaterial({
      wireframe: true, transparent: true,
      uniforms: {
        uBaseColor: { value: new THREE.Color(color) },
        uScanColor: { value: new THREE.Color(0xff6b35) },
        uScanWorldPos: { value: new THREE.Vector3(0, 0, 99) },
        uScanDir: { value: new THREE.Vector3(0, 0, 1) },
        uScanWidth: { value: 1.2 },
        uOpacity: { value: opacity }
      },
      vertexShader: scanReactiveVert,
      fragmentShader: scanReactiveFrag
    })
    const bodyMat = makeScanMat((MESH_COLORS[partColors.body] || MESH_COLORS[0]).primary, 0.7)
    const tireMat = makeScanMat((MESH_COLORS[partColors.tire] || MESH_COLORS[0]).primary, 0.6)
    const rimMat = makeScanMat((MESH_COLORS[partColors.rim] || MESH_COLORS[0]).primary, 0.7)
    const lightMat = makeScanMat((MESH_COLORS[partColors.light] || MESH_COLORS[0]).primary, 0.8)
    const seatMat = makeScanMat((MESH_COLORS[partColors.seat] || MESH_COLORS[0]).primary, 0.35)
    const glassMat = new THREE.MeshBasicMaterial({ color: bc.glass, wireframe: true, transparent: true, opacity: 0.5 })

    // ── Ground grid ──
    const gridHelper = new THREE.GridHelper(80, 80, new THREE.Color(bc.grid), new THREE.Color(bc.gridDim))
    gridHelper.position.y = -0.01
    const gridMat = gridHelper.material
    if (Array.isArray(gridMat)) {
      gridMat.forEach(m => { m.transparent = true; m.opacity = 0.25 })
    } else {
      gridMat.transparent = true; gridMat.opacity = 0.25
    }
    scene.add(gridHelper)

    // ── Floating data points ──
    const particlesGeo = new THREE.BufferGeometry()
    const pCount = 200
    const pPositions = new Float32Array(pCount * 3)
    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 40
      pPositions[i * 3 + 1] = Math.random() * 8
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    const particlesMat = new THREE.PointsMaterial({ color: bc.particle, size: 0.08, transparent: true, opacity: 0.4 })
    const particles = new THREE.Points(particlesGeo, particlesMat)
    scene.add(particles)

    // ── Scanning beam — EXL orange, gradient: opaque top → transparent bottom ──
    const scanGeo = new THREE.PlaneGeometry(7, 3)
    const scanMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0xff6b35) },
        uOpacity: { value: 0.35 }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ float alpha = vUv.y * uOpacity; gl_FragColor = vec4(uColor, alpha); }`
    })
    const scanBeam = new THREE.Mesh(scanGeo, scanMat)
    scanBeam.position.set(0, 1.5, 0)
    // Group them; added to carGroup after model loads
    const scanGroup = new THREE.Group()
    scanGroup.add(scanBeam)


    // Store materials ref for live color updates
    const gMat = Array.isArray(gridMat) ? gridMat[0] : gridMat
    const gMat2 = Array.isArray(gridMat) ? gridMat[1] : gridMat
    materialsRef.current = { body: bodyMat, tire: tireMat, rim: rimMat, light: lightMat, seat: seatMat, glass: glassMat, grid1: gMat, grid2: gMat2, particle: particlesMat }

    // ── Load the Ferrari GLB model ──
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    let carGroup: THREE.Group | null = null
    let loadedModel: THREE.Object3D | null = null
    let scanSweepRange = 2.5 // default, updated once model loads

    gltfLoader.load('/models/ferrari.glb', (gltf) => {
      const model = gltf.scene
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          const name = (mesh.name || '').toLowerCase()
          // Glass
          if (name.includes('glass') || name.includes('cristal')) {
            mesh.material = glassMat
            // Tires
          } else if (name === 'tire') {
            mesh.material = tireMat
            // Rims & wheel hardware
          } else if (name.startsWith('rim_') || name === 'wheel' || name === 'centre' || name === 'nuts' || name === 'brake' || name === 'brakes') {
            mesh.material = rimMat
            // Lights
          } else if (name === 'lights' || name === 'lights_red' || name === 'leds' || name.includes('red_light')) {
            mesh.material = lightMat
            // Interior / seats
          } else if (name === 'leather' || name === 'carpet' || name.includes('interior') || name.includes('steering')) {
            mesh.material = seatMat
            // Body (everything else: body, blue, trim, chrome, metal, grills, wipers, carbon, plastic, yellow_trim)
          } else {
            mesh.material = bodyMat
          }
        }
      })
      model.scale.setScalar(2.8)
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      model.position.y += (box.max.y - box.min.y) * 0.5 * 2.8 * 0.1
      loadedModel = model

      carGroup = new THREE.Group()
      carGroup.add(model)
      carGroup.add(scanGroup) // scan wall rotates with car
      carGroup.position.x = isMobile ? -0.2 : -2.6 // desktop: shift left; mobile: 10% more right
      carGroup.position.y = isMobile ? 8.4 : 0   // mobile: 25% more up
      // Measure car after positioning to align scan wall
      const carBox = new THREE.Box3().setFromObject(model)
      scanSweepRange = (carBox.max.z - carBox.min.z) / 2 + 0.3
      const carBottom = carBox.min.y
      const carHeight = carBox.max.y - carBox.min.y
      // Reposition scan wall: bottom edge at car's bottom
      scanBeam.position.y = carBottom + carHeight / 2
      scanBeam.scale.y = carHeight / 3
      scene.add(carGroup)
    }, undefined, (err) => {
      console.warn('GLB load failed, falling back', err)
    })

    // ── HUD overlay ──
    const hudCanvas = document.createElement('canvas')
    hudCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'
    el.appendChild(hudCanvas)
    const hCtx = hudCanvas.getContext('2d')!

    const drawHUD = (t: number) => {
      const w = el.clientWidth, h = el.clientHeight
      const dpr = window.devicePixelRatio || 1
      hudCanvas.width = w * dpr; hudCanvas.height = h * dpr
      hudCanvas.style.width = w + 'px'; hudCanvas.style.height = h + 'px'
      hCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      hCtx.clearRect(0, 0, w, h)
      const hc = hudColorRef.current

      // Corner brackets
      const bL = 28, bP = 8
      hCtx.strokeStyle = hc + '0.2)'; hCtx.lineWidth = 1.2
      hCtx.beginPath(); hCtx.moveTo(bP, bP + bL); hCtx.lineTo(bP, bP); hCtx.lineTo(bP + bL, bP); hCtx.stroke()
      hCtx.beginPath(); hCtx.moveTo(w - bP - bL, bP); hCtx.lineTo(w - bP, bP); hCtx.lineTo(w - bP, bP + bL); hCtx.stroke()
      hCtx.beginPath(); hCtx.moveTo(bP, h - bP - bL); hCtx.lineTo(bP, h - bP); hCtx.lineTo(bP + bL, h - bP); hCtx.stroke()
      hCtx.beginPath(); hCtx.moveTo(w - bP - bL, h - bP); hCtx.lineTo(w - bP, h - bP); hCtx.lineTo(w - bP, h - bP - bL); hCtx.stroke()

      // Data readouts
      hCtx.font = '10px monospace'; hCtx.fillStyle = hc + '0.35)'
      hCtx.textAlign = 'left'
      hCtx.fillText(`SCAN: ${(t * 30 % 360).toFixed(1)}\u00B0`, bP + 4, bP + bL + 16)
      hCtx.fillText(`POLY: 392,847`, bP + 4, bP + bL + 30)
      hCtx.fillText(`MODEL: FERRARI 458`, bP + 4, bP + bL + 44)
      hCtx.textAlign = 'right'
      hCtx.fillText(`MATCH: ${(89 + Math.sin(t * 0.8) * 6).toFixed(1)}%`, w - bP - 4, bP + bL + 16)
      hCtx.fillText(`CLASS: SUPERCAR`, w - bP - 4, bP + bL + 30)
      hCtx.fillText(`AI CONF: ${(94 + Math.sin(t * 0.6) * 4).toFixed(1)}%`, w - bP - 4, bP + bL + 44)
      hCtx.textAlign = 'center'
      hCtx.font = '9px monospace'; hCtx.fillStyle = hc + '0.18)'
      hCtx.fillText('/// FORENSIC 3D WIREFRAME RECONSTRUCTION \u2014 AI ANALYSIS ACTIVE ///', w / 2, h - bP - 4)

      // Scan data readout lines — tied to beam sweep position
      const scanProgress = (Math.sin(t * 0.6) + 1) / 2 // 0 to 1
      const dataLines = ['STRUCTURE INTEGRITY', 'PIXEL VARIANCE', 'NOISE FLOOR', 'COMPRESSION ARTIFACTS', 'GAN FINGERPRINT']
      const dlX = w * 0.03, dlW = w * 0.12
      hCtx.font = '7px monospace'
      dataLines.forEach((dl, i) => {
        const lineY = h * 0.3 + i * 16
        const barProgress = Math.max(0, Math.min(1, scanProgress * 2 - i * 0.15))
        const a = barProgress > 0 ? 0.3 : 0.08
        // Label
        hCtx.fillStyle = hc + a.toFixed(2) + ')'
        hCtx.textAlign = 'left'
        hCtx.fillText(dl, dlX, lineY - 2)
        // Bar background
        hCtx.fillStyle = hc + '0.06)'
        hCtx.fillRect(dlX, lineY, dlW, 3)
        // Bar fill
        if (barProgress > 0) {
          hCtx.fillStyle = 'rgba(0,170,255,' + (a * 0.8).toFixed(2) + ')'
          hCtx.fillRect(dlX, lineY, dlW * barProgress, 3)
        }
      })

      // Floating analysis tags — orbit around car area
      const tags = ['PIXEL ANALYSIS', 'METADATA CHECK', 'ELA SCAN', 'AI PROBABILITY', 'NOISE PATTERN', 'EXIF VERIFY']
      const cx = w * 0.35, cy = h * 0.48 // orbit center (left of center where car is)
      const rx = w * 0.18, ry = h * 0.22 // orbit radii
      hCtx.font = '8px monospace'
      tags.forEach((tag, i) => {
        const angle = t * 0.15 + (i / tags.length) * Math.PI * 2
        const tx = cx + Math.cos(angle) * rx
        const ty = cy + Math.sin(angle) * ry * 0.6
        const alpha = 0.12 + Math.max(0, Math.sin(angle)) * 0.18 // brighter on front side
        hCtx.fillStyle = hc + alpha.toFixed(2) + ')'
        hCtx.textAlign = 'center'
        hCtx.fillText(`[ ${tag} ]`, tx, ty)
      })
      // Evidence frames — floating classification badges
      const frames = [
        { label: 'REAL', color: '#4ade80', x: 0.12, y: 0.30, phase: 0 },
        { label: 'AI EDITED / GEN', color: '#f87171', x: 0.12, y: 0.55, phase: 2.5 },
      ]
      frames.forEach(fr => {
        const fx = w * (fr.x + Math.sin(t * 0.1 + fr.phase) * 0.015)
        const fy = h * (fr.y + Math.cos(t * 0.08 + fr.phase) * 0.01)
        const fw = 72, fh = 20
        // Frame border
        hCtx.strokeStyle = fr.color + '30'
        hCtx.lineWidth = 1
        hCtx.strokeRect(fx - fw / 2, fy - fh / 2, fw, fh)
        // Background fill
        hCtx.fillStyle = fr.color + '08'
        hCtx.fillRect(fx - fw / 2, fy - fh / 2, fw, fh)
        // Label text
        hCtx.font = '8px monospace'
        hCtx.fillStyle = fr.color + '50'
        hCtx.textAlign = 'center'
        hCtx.fillText(fr.label, fx, fy + 3)
      })
      hCtx.textAlign = 'left'
    }

    // ── Animation loop ──
    let t = 0
    const clock = new THREE.Clock()
    // Store original particle Y positions to avoid drift
    const baseY = new Float32Array(pCount)
    for (let i = 0; i < pCount; i++) baseY[i] = pPositions[i * 3 + 1]

    let currentRot = 0
    const baseCamY = isMobile ? 14 : 8.4
    let currentCamY = baseCamY

    // Frame-rate-independent damping: returns the lerp alpha for a given delta
    const damp = (smoothing: number, dt: number) => 1 - Math.exp(-smoothing * dt)

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05) // cap to avoid jumps on tab-switch
      t += delta

      // Rotation: ~30s per revolution, damped for silky motion
      const targetRot = t * 0.21
      currentRot += (targetRot - currentRot) * damp(1.5, delta)
      if (carGroup) carGroup.rotation.y = currentRot

      // Gentle particle drift
      const pos = particles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pCount; i++) pos.setY(i, baseY[i] + Math.sin(t * 0.08 + i * 0.7) * 0.04)
      pos.needsUpdate = true

      // Scan beam: sweeps front-to-back at constant speed
      const scanZ = Math.sin(t * 0.6) * scanSweepRange
      scanGroup.position.z = scanZ
        ; (scanMat as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.25 + Math.abs(Math.cos(t * 0.6)) * 0.2
      // Feed scan world position + direction to car materials so meshes highlight as beam passes
      if (carGroup) {
        const swp = new THREE.Vector3()
        scanGroup.getWorldPosition(swp)
        const sdir = new THREE.Vector3(0, 0, 1).applyQuaternion(carGroup.quaternion).normalize()
          ;[bodyMat, tireMat, rimMat, lightMat, seatMat].forEach(m => {
            m.uniforms.uScanWorldPos.value.copy(swp)
            m.uniforms.uScanDir.value.copy(sdir)
          })
      }
      // Beam width pulsing: breathe between 0.85x and 1.15x
      const widthPulse = 1 + Math.sin(t * 1.2) * 0.15
      scanBeam.scale.x = widthPulse

      // Camera: barely-perceptible breathing, damped
      const targetCamY = baseCamY + Math.sin(t * 0.06) * 0.05
      currentCamY += (targetCamY - currentCamY) * damp(1.5, delta)
      camera.position.y = currentCamY
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
      drawHUD(t)
    }
    renderer.setAnimationLoop(animate)

    // ── Resize ──
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      renderer.setAnimationLoop(null); renderer.dispose(); dracoLoader.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      if (el.contains(hudCanvas)) el.removeChild(hudCanvas)
      scene.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', background: 'transparent',
    }} />
  )
}


/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface ImageItem { id: number; image_url: string }
interface LBEntry { id?: number; player_name: string; score: number; images_played: number; accuracy: number }
interface Answer { image_id: number; answer: string; correct_label: string; is_correct: boolean; points: number; time_spent: number }

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
interface Props { onBack: () => void }

export default function ImageGamePage({ onBack }: Props) {
  const [phase, setPhase] = useState<'welcome' | 'name' | 'playing' | 'final' | 'leaderboard'>('welcome')
  const [images, setImages] = useState<ImageItem[]>([])
  const [lb, setLb] = useState<LBEntry[]>([])
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_PER_IMAGE)
  const [timerActive, setTimerActive] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [soundOn, setSoundOn] = useState(true)
  const [musicVol, setMusicVol] = useState(0.35)
  const [loading, setLoading] = useState(true)
  const [showResult, setShowResult] = useState(false)
  const [lastResult, setLastResult] = useState<{ correct: boolean; label: string; points: number } | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [partColors] = useState<PartColors>({ body: 0, tire: 0, rim: 0, light: 1, seat: 0 })

  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bgMusic = useRef(new AmbientMusic())
  // Track previous leaderboard positions for animation: key → previous rank index
  const prevPositions = useRef<Map<string, number>>(new Map())
  const [posChanges, setPosChanges] = useState<Map<string, number>>(new Map())

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

  // Fetch images + leaderboard
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/image-game/images`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_BASE_URL}/api/image-game/leaderboard`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([imgs, lbData]) => {
      setImages(imgs); setLb(lbData); setLoading(false)
      // Seed position tracking so first poll doesn't show false changes
      const posMap = new Map<string, number>()
        ; (lbData as LBEntry[]).forEach((e, i) => posMap.set(lbKey(e), i))
      prevPositions.current = posMap
    })
  }, [])

  // Timer
  useEffect(() => {
    if (!timerActive) return
    if (timeLeft <= 0) { handleTimeUp(); return }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, timerActive])

  // Tick sound
  useEffect(() => {
    if (timerActive && timeLeft <= 5 && timeLeft > 0) play('tick')
  }, [timeLeft, timerActive, play])

  const lbKey = (e: LBEntry) => `${e.player_name}::${e.id ?? e.score}`

  const refreshLb = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/image-game/leaderboard`)
      if (!r.ok) return
      const newLb: LBEntry[] = await r.json()

      // Compute position changes vs previous snapshot
      if (prevPositions.current.size > 0) {
        const changes = new Map<string, number>()
        newLb.forEach((e, newIdx) => {
          const key = lbKey(e)
          const oldIdx = prevPositions.current.get(key)
          if (oldIdx !== undefined && oldIdx !== newIdx) {
            changes.set(key, oldIdx - newIdx) // positive = moved up, negative = moved down
          }
        })
        if (changes.size > 0) {
          setPosChanges(changes)
          // Clear the badges after the animation finishes
          setTimeout(() => setPosChanges(new Map()), 2000)
        }
      }

      // Store current positions for next comparison
      const posMap = new Map<string, number>()
      newLb.forEach((e, i) => posMap.set(lbKey(e), i))
      prevPositions.current = posMap

      setLb(newLb)
    } catch { /* */ }
  }, [])

  // Auto-refresh leaderboard every 5s when on welcome, final, or leaderboard phase
  useEffect(() => {
    if (phase !== 'leaderboard' && phase !== 'final' && phase !== 'welcome') return
    refreshLb() // immediate fetch on phase entry
    const id = setInterval(refreshLb, 5000)
    return () => clearInterval(id)
  }, [phase, refreshLb])

  const getMyPosition = useCallback(() => {
    // Simulate: find where current score would place
    const pos = lb.filter(e => e.score > score).length + 1
    return pos
  }, [lb, score])

  const handleTimeUp = useCallback(() => {
    if (answering) return
    handleAnswer('__timeout__')
  }, [answering])

  const handleAnswer = async (answer: string) => {
    if (answering) return
    if (!images[currentIdx]) return
    setAnswering(true)
    setTimerActive(false)
    const elapsed = TIME_PER_IMAGE - timeLeft
    const isTimeout = answer === '__timeout__'

    let correct = false
    let correctLabel = ''

    if (!isTimeout) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/image-game/check-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: images[currentIdx].id, answer }),
        })
        const data = await res.json()
        correct = data.correct
        correctLabel = data.correct_label
      } catch {
        correct = false
        correctLabel = 'unknown'
      }
    } else {
      // Timeout — fetch correct label
      try {
        const res = await fetch(`${API_BASE_URL}/api/image-game/check-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_id: images[currentIdx].id, answer: '__none__' }),
        })
        const data = await res.json()
        correctLabel = data.correct_label
      } catch {
        correctLabel = 'unknown'
      }
    }

    const newStreak = correct ? streak + 1 : 0
    const pts = isTimeout ? 0 : calcPoints(correct, elapsed, correct ? streak : 0)
    const newScore = score + pts

    if (correct) {
      const hasSpeedBonus = elapsed < TIME_PER_IMAGE * 0.4
      play(newStreak >= 3 ? 'streak' : hasSpeedBonus ? 'speedBonus' : 'correct')
    } else {
      play(streak >= 3 ? 'streakBreak' : 'wrong')
    }

    const newAnswer: Answer = {
      image_id: images[currentIdx].id, answer: isTimeout ? 'timeout' : answer,
      correct_label: correctLabel, is_correct: correct, points: pts, time_spent: elapsed,
    }
    const newAnswers = [...answers, newAnswer]

    setStreak(newStreak)
    if (newStreak > bestStreak) setBestStreak(newStreak)
    setScore(newScore)
    setAnswers(newAnswers)
    setLastResult({ correct, label: correctLabel, points: pts })
    setShowResult(true)

    // Save session
    fetch(`${API_BASE_URL}/api/image-game/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: playerName,
        current_image_idx: currentIdx + 1,
        image_ids: images.map(i => i.id),
        answers: newAnswers,
        score: newScore,
        streak: newStreak,
      }),
    }).catch(() => { })

    refreshLb()

    resultTimeout.current = setTimeout(() => {
      setShowResult(false)
      setLastResult(null)
      setAnswering(false)
      setImgLoaded(false)
      if (currentIdx + 1 >= images.length) {
        setPhase('final')
      } else {
        if (currentIdx + 2 === images.length) play('lastImage')
        else play('newImage')
        setCurrentIdx(i => i + 1)
        setTimeLeft(TIME_PER_IMAGE)
        setTimerActive(true)
      }
    }, 2000)
  }

  const startGame = (resumeData?: any) => {
    if (resumeData) {
      setCurrentIdx(resumeData.current_image_idx || 0)
      setAnswers(resumeData.answers || [])
      setScore(resumeData.score || 0)
      setStreak(resumeData.streak || 0)
      // Restore image order if available
      if (resumeData.image_ids?.length) {
        const idMap = new Map(images.map(im => [im.id, im]))
        const ordered = (resumeData.image_ids as number[]).map(id => idMap.get(id)).filter(Boolean) as ImageItem[]
        if (ordered.length) setImages(ordered)
      }
    } else {
      setCurrentIdx(0)
      setAnswers([])
      setScore(0)
      setStreak(0)
      setBestStreak(0)
    }
    setTimeLeft(TIME_PER_IMAGE)
    setTimerActive(true)
    setPhase('playing')
    play('click')
  }

  const checkSession = async (name: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/image-game/session/${encodeURIComponent(name)}`)
      if (r.ok) {
        const data = await r.json()
        if (data && data.status === 'in_progress') return data
      }
    } catch { /* */ }
    return null
  }

  const submitFinal = async () => {
    const correct = answers.filter(a => a.is_correct).length
    const acc = answers.length > 0 ? correct / answers.length : 0
    try {
      await fetch(`${API_BASE_URL}/api/image-game/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score, imagesPlayed: answers.length, accuracy: Math.round(acc * 100) / 100 }),
      })
      await fetch(`${API_BASE_URL}/api/image-game/session/${encodeURIComponent(playerName)}`, { method: 'DELETE' })
    } catch { /* */ }
    await refreshLb()
    play(acc >= 1.0 && answers.length > 0 ? 'perfect' : 'gameOver')
    setPhase('leaderboard')
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  const timerColor = timeLeft > 10 ? '#22D07A' : timeLeft > 5 ? '#FBBF24' : '#F87171'
  const timerPct = (timeLeft / TIME_PER_IMAGE) * 100

  return (
    <SoundCtx.Provider value={{ play, soundOn }}>
      <div className="game-root" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Sound toggle + volume */}
        {phase !== 'playing' && (
          <div style={{
            position: 'fixed', top: '16px', right: '16px', zIndex: 50,
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(16,19,26,.85)', border: '1px solid var(--exl-border)',
            backdropFilter: 'blur(8px)',
          }}>
            <button onClick={() => { setSoundOn(v => !v); play('click') }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: 'var(--exl-text-soft)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              <SpeakerIcon on={soundOn} s={14} />
              {soundOn ? 'ON' : 'OFF'}
            </button>
            {soundOn && (
              <input type="range" min="0" max="100" value={Math.round(musicVol * 100)}
                onChange={e => { const v = parseInt(e.target.value) / 100; setMusicVol(v); bgMusic.current.setVolume(v) }}
                style={{ width: '60px', height: '3px', accentColor: '#FF6B35', cursor: 'pointer' }}
                title={`Music: ${Math.round(musicVol * 100)}%`}
              />
            )}
          </div>
        )}

        {/* ═══ WELCOME — Full-bleed 3D background, no tiles ═══ */}
        {phase === 'welcome' && (
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Full-screen 3D wireframe background */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <WireframeHero partColors={partColors} />
            </div>

            {/* Gradient overlay for readability on right side */}
            <div className="welcome-gradient" style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'linear-gradient(to right, transparent 35%, rgba(10,12,18,0.65) 55%, rgba(10,12,18,0.92) 70%)',
              pointerEvents: 'none',
            }} />
            {/* Bottom fade */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', zIndex: 1,
              background: 'linear-gradient(to top, rgba(10,12,18,0.7), transparent)',
              pointerEvents: 'none',
            }} />

            {/* Content overlay */}
            <div className="welcome-overlay" style={{ position: 'relative', zIndex: 2, display: 'flex', height: '100%' }}>

              {/* ── LEFT: 3D area (transparent, just has back button + scan info + color selector) ── */}
              <div className="welcome-left" style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', padding: '20px 24px', position: 'relative' }}>
                {/* Back button */}
                <button onClick={onBack} className="exl-btn-ghost" style={{
                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                  background: 'rgba(10,12,18,0.5)', backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 14px',
                }}>
                  <ArrowLeftIcon s={14} /> Back
                </button>

                {/* Scan status — top right of left area */}
                <div className="welcome-scan-status" style={{
                  position: 'absolute', top: '20px', right: '24px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: 'rgba(10,12,15,0.6)', backdropFilter: 'blur(6px)',
                  fontSize: '9px', fontFamily: 'monospace', color: MESH_COLORS[partColors.body].primary + 'aa', lineHeight: 1.7,
                }}>
                  <div>STATUS: <span style={{ opacity: 0.9 }}>ACTIVE</span></div>
                  <div>IMAGES: <span style={{ color: ORANGE }}>{images.length || '---'}</span></div>
                  <div>MODE: CLASSIFICATION</div>
                </div>

                <div style={{ flex: 1 }} />

                {/* QR Code — scan to play */}
                <div className="welcome-qr" style={{
                  alignSelf: 'flex-start',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(10,12,18,0.6)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    padding: '8px', borderRadius: '8px', background: '#fff',
                    lineHeight: 0,
                  }}>
                    <QRCodeSVG
                      value={window.location.href}
                      size={100}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0a0c12"
                    />
                  </div>
                  <div style={{
                    fontSize: '8px', fontFamily: 'monospace', fontWeight: 700,
                    color: MESH_COLORS[partColors.body].primary + 'aa',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>
                    Scan to Play
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Details panel (no card, just content over gradient) ── */}
              <div className="welcome-right" style={{
                flex: '0 0 420px', maxWidth: '440px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '40px 40px 40px 20px', overflow: 'auto',
              }}>
                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `linear-gradient(135deg, ${ORANGE}30, ${ORANGE}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CameraIcon s={24} c={ORANGE} />
                  </div>
                  <div>
                    <div className="title-main" style={{ fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.1 }}>IMAGE DETECTIVE</div>
                    <div style={{ fontSize: '10px', color: MESH_COLORS[partColors.body].primary + 'aa', fontWeight: 700, letterSpacing: '0.15em', marginTop: '3px', fontFamily: 'monospace' }}>AI FORENSICS DIVISION</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--exl-text-soft)', lineHeight: 1.6, marginBottom: '28px' }}>
                  Can you tell real claim images from AI-generated fakes? Test your eye against <span style={{ color: ORANGE, fontWeight: 700 }}>{images.length || '...'}</span> images.
                </div>

                {/* How it works */}
                <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', marginBottom: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--exl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>How It Works</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--exl-text-soft)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><ClockIcon s={13} c="var(--exl-text-muted)" /> {TIME_PER_IMAGE}s per image — fast answers earn bonus</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><FireIcon s={13} /> Build streaks for extra points</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><TrophyIcon s={13} c="var(--exl-text-muted)" /> Compete on the live leaderboard</div>
                  </div>
                </div>

                {/* Leaderboard preview */}
                <div style={{ maxHeight: '240px', overflow: 'auto', padding: '14px 18px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <TrophyIcon s={14} c={ORANGE} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--exl-text)', letterSpacing: '0.04em' }}>LEADERBOARD</span>
                  </div>
                  {lb.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--exl-text-muted)', textAlign: 'center', padding: '16px 0' }}>No scores yet. Be the first!</div>
                  ) : lb.slice(0, 8).map((e, i) => (
                    <div key={i} className="lb-row" style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '6px',
                      background: i < 3 ? `rgba(255,107,53,${0.08 - i * 0.02})` : 'transparent',
                      animation: `stagger1 .3s ease both`, animationDelay: `${0.05 + i * 0.06}s`,
                    }}>
                      <span style={{ width: '20px', fontSize: '10px', fontWeight: 700, color: i < 3 ? ORANGE : 'var(--exl-text-muted)', textAlign: 'center' }}>
                        {i === 0 ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={ORANGE} stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>
                        ) : `#${i + 1}`}
                      </span>
                      <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: 'var(--exl-text)' }}>{e.player_name}</span>
                      <span style={{ fontSize: '9px', color: 'var(--exl-text-muted)' }}>{getRankTitle(e.score)}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, fontFamily: "'Oswald', sans-serif" }}>{e.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Begin button */}
                <button onClick={() => { play('click'); if (soundOn) { const sfx = new Audio(carEngineUrl); sfx.volume = 0.7; sfx.play().catch(() => { }) } setPhase('name') }} className="exl-btn-primary glow-pulse"
                  disabled={loading || images.length < 3}
                  style={{ padding: '16px 36px', fontSize: '16px', fontWeight: 700, letterSpacing: '0.04em', width: '100%' }}>
                  {loading ? 'Loading...' : images.length < 3 ? 'Not Enough Images' : 'Begin Investigation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ NAME ENTRY ═══ */}
        {phase === 'name' && (
          <div className="phase-name-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div className="g-card phase-name-card" style={{ padding: '32px 40px', maxWidth: '460px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <CameraIcon s={22} c={ORANGE} />
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--exl-text)' }}>Enter Your Name</span>
              </div>
              <input
                className="exl-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    const name = nameInput.trim()
                    setPlayerName(name)
                    const session = await checkSession(name)
                    if (session) {
                      setHasSession(true)
                    } else {
                      startGame()
                    }
                  }
                }}
                placeholder="Your detective name..."
                autoFocus
                style={{ width: '100%', marginBottom: '16px', fontSize: '15px', padding: '12px 16px' }}
              />

              {hasSession ? (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--exl-text-soft)', marginBottom: '14px' }}>
                    You have an in-progress game. Resume or start fresh?
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={async () => {
                      const session = await checkSession(playerName)
                      if (session) startGame(session)
                      else startGame()
                    }} className="exl-btn-primary" style={{ flex: 1, padding: '10px' }}>
                      Resume
                    </button>
                    <button onClick={async () => {
                      await fetch(`${API_BASE_URL}/api/image-game/session/${encodeURIComponent(playerName)}`, { method: 'DELETE' }).catch(() => { })
                      setHasSession(false)
                      startGame()
                    }} className="exl-btn-ghost" style={{ flex: 1, padding: '10px' }}>
                      Start Fresh
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { play('click'); setPhase('welcome') }} className="exl-btn-ghost" style={{ padding: '10px 20px' }}>
                    <ArrowLeftIcon s={14} /> Back
                  </button>
                  <button
                    onClick={() => {
                      if (!nameInput.trim()) return
                      const name = nameInput.trim()
                      setPlayerName(name)
                      startGame()
                    }}
                    className="exl-btn-primary"
                    disabled={!nameInput.trim()}
                    style={{ flex: 1, padding: '10px 24px', fontSize: '14px', fontWeight: 700 }}>
                    Start Game
                  </button>
                </div>
              )}

              {/* Scoring rules */}
              <div style={{ marginTop: '24px', padding: '14px 16px', borderRadius: '10px', background: 'var(--exl-surface-2)', border: '1px solid var(--exl-border)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--exl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Scoring</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--exl-text-soft)' }}>
                  <div>Correct: {BASE_POINTS} pts + speed bonus (up to {SPEED_BONUS_MAX})</div>
                  <div>Streak bonus: +{STREAK_BONUS} pts per consecutive correct</div>
                  <div>Wrong: {WRONG_PENALTY} pts penalty</div>
                  <div>Timeout: 0 pts</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PLAYING ═══ */}
        {phase === 'playing' && images.length > 0 && (
          <div className="game-playing-root">
            {/* Top bar */}
            <div className="game-topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => { play('click'); setPhase('final') }}
                  title="Exit game"
                  style={{ background: 'rgba(16,19,26,.6)', border: '1px solid var(--exl-border)', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer', color: 'var(--exl-text-soft)', display: 'flex', alignItems: 'center', lineHeight: 0 }}>
                  <XIcon s={14} />
                </button>
                <CameraIcon s={18} c={ORANGE} />
                <span className="game-topbar-label">
                  {currentIdx + 1} / {images.length}
                </span>
                {streak >= 2 && (
                  <span className="streak-badge">
                    <FireIcon s={10} /> {streak}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: timerColor }}>
                  <ClockIcon s={14} c={timerColor} />
                  {timeLeft}s
                </div>
                <div className="game-topbar-score">
                  {score.toLocaleString()}
                </div>
                {/* Position badge — visible on mobile where sidebar is hidden */}
                <div className="game-topbar-position">
                  #{getMyPosition()}
                </div>
                <button onClick={() => setSoundOn(v => !v)}
                  className="game-sound-btn">
                  <SpeakerIcon on={soundOn} s={12} />
                </button>
                {soundOn && (
                  <input type="range" min="0" max="100" value={Math.round(musicVol * 100)}
                    onChange={e => { const v = parseInt(e.target.value) / 100; setMusicVol(v); bgMusic.current.setVolume(v) }}
                    style={{ width: '50px', height: '3px', accentColor: '#FF6B35', cursor: 'pointer' }}
                    title={`Music: ${Math.round(musicVol * 100)}%`}
                  />
                )}
              </div>
            </div>

            {/* Timer bar */}
            <div className="timer-bar" style={{ marginBottom: '8px', flexShrink: 0 }}>
              <div className={`timer-bar-fill ${timeLeft > 10 ? 'timer-bar-fill-safe' : timeLeft > 5 ? 'timer-bar-fill-warn' : 'timer-bar-fill-danger'}`}
                style={{ width: `${timerPct}%` }} />
            </div>

            {/* Main content: Image + Sidebar */}
            <div className="game-main-grid">
              {/* Image */}
              <div className="image-detective-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                {!imgLoaded && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--exl-text-muted)', fontSize: '13px' }}>
                    Loading image...
                  </div>
                )}
                <img
                  src={`${API_BASE_URL}${images[currentIdx].image_url}`}
                  alt={`Evidence ${currentIdx + 1}`}
                  onLoad={() => setImgLoaded(true)}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: imgLoaded ? 'block' : 'none' }}
                />
              </div>

              {/* Live Leaderboard Sidebar — hidden on mobile */}
              <div className="live-lb-sidebar game-sidebar-desktop">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <TrophyIcon s={14} c={ORANGE} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--exl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Ranking</span>
                </div>

                {/* Your position */}
                <div style={{
                  padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                  background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`,
                  border: `1px solid ${ORANGE}40`,
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--exl-text-muted)', marginBottom: '4px' }}>YOUR POSITION</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif" }}>#{getMyPosition()}</span>
                    <span style={{ fontSize: '12px', color: 'var(--exl-text-soft)' }}>{score} pts</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--exl-text-muted)', marginTop: '2px' }}>{getRankTitle(score)}</div>
                </div>

                {/* Top 5 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {lb.slice(0, 5).map((e, i) => (
                    <div key={i} className={`live-lb-row ${e.player_name === playerName ? 'live-lb-row-current' : ''}`}>
                      <span style={{ width: '20px', fontSize: '10px', fontWeight: 700, color: i === 0 ? ORANGE : 'var(--exl-text-muted)', textAlign: 'center' }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: 'var(--exl-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.player_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, fontFamily: "'Oswald', sans-serif" }}>{e.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Answer buttons */}
            <div className="game-answer-grid">
              {(['real', 'ai'] as const).map(key => {
                const m = LABEL_META[key]
                const Icon = key === 'real' ? ShieldIcon : SparklesIcon
                return (
                  <button key={key} className={`answer-btn answer-btn-${key === 'real' ? 'real' : 'generated'}`}
                    onClick={() => { play('click'); handleAnswer(key) }}
                    disabled={answering || showResult}>
                    <Icon s={18} c={m.color} />
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ RESULT OVERLAY ═══ */}
        {showResult && lastResult && (
          <div className="result-overlay">
            <div style={{
              padding: '32px 48px', borderRadius: '16px', textAlign: 'center',
              background: 'var(--exl-surface)',
              border: `2px solid ${lastResult.correct ? 'rgba(34,208,122,.5)' : 'rgba(248,113,113,.5)'}`,
              boxShadow: `0 12px 40px ${lastResult.correct ? 'rgba(34,208,122,.15)' : 'rgba(248,113,113,.15)'}`,
            }}>
              {lastResult.correct ? <CheckIcon s={48} /> : <XIcon s={48} />}
              <div style={{ fontSize: '22px', fontWeight: 800, color: lastResult.correct ? '#22D07A' : '#F87171', marginTop: '10px', fontFamily: "'Oswald', sans-serif", letterSpacing: '0.04em' }}>
                {lastResult.correct ? 'CORRECT!' : 'WRONG'}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--exl-text-soft)', marginTop: '6px' }}>
                This image was <strong style={{ color: LABEL_META[lastResult.label]?.color || 'var(--exl-text)' }}>
                  {LABEL_META[lastResult.label]?.name || lastResult.label}
                </strong>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif", marginTop: '10px' }}>
                {lastResult.points >= 0 ? '+' : ''}{lastResult.points} PTS
              </div>
              {streak >= 2 && lastResult.correct && (
                <div className="streak-badge" style={{ margin: '8px auto 0' }}>
                  <FireIcon s={12} /> {streak} STREAK
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--exl-text-muted)', marginTop: '8px' }}>
                Position: #{getMyPosition()}
              </div>
            </div>
          </div>
        )}

        {/* ═══ FINAL ═══ */}
        {phase === 'final' && (
          <div className="phase-final-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', overflow: 'auto' }}>
            <div className="g-card phase-final-card" style={{ padding: '36px 48px', maxWidth: '520px', width: '100%', textAlign: 'center' }}>
              <CameraIcon s={40} c={ORANGE} />
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--exl-text)', fontFamily: "'Oswald', sans-serif", marginTop: '12px', letterSpacing: '0.04em' }}>
                INVESTIGATION COMPLETE
              </div>
              <div style={{ fontSize: '42px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif", marginTop: '8px' }}>
                {score.toLocaleString()} PTS
              </div>
              <div style={{ fontSize: '13px', color: 'var(--exl-text-muted)', marginTop: '4px' }}>{getRankTitle(score)}</div>

              <div className="final-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '24px' }}>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--exl-surface-2)', border: '1px solid var(--exl-border)' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#22D07A', fontFamily: "'Oswald', sans-serif" }}>
                    {answers.filter(a => a.is_correct).length}/{answers.length}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--exl-text-muted)', fontWeight: 600 }}>CORRECT</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--exl-surface-2)', border: '1px solid var(--exl-border)' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif" }}>
                    {answers.length > 0 ? Math.round((answers.filter(a => a.is_correct).length / answers.length) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--exl-text-muted)', fontWeight: 600 }}>ACCURACY</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--exl-surface-2)', border: '1px solid var(--exl-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <FireIcon s={16} />
                    <span style={{ fontSize: '22px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif" }}>{bestStreak}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--exl-text-muted)', fontWeight: 600 }}>BEST STREAK</div>
                </div>
              </div>

              {/* Answer breakdown */}
              <div style={{ marginTop: '20px', textAlign: 'left' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--exl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Results</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflow: 'auto' }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'var(--exl-surface-2)', border: '1px solid var(--exl-border)' }}>
                      <span style={{ width: '20px', fontSize: '10px', fontWeight: 700, color: 'var(--exl-text-muted)' }}>#{i + 1}</span>
                      {a.is_correct ? <CheckIcon s={14} /> : <XIcon s={14} />}
                      <span style={{ flex: 1, fontSize: '11px', color: 'var(--exl-text-soft)' }}>
                        Answered: {LABEL_META[a.answer]?.name || a.answer} — Actual: <strong style={{ color: LABEL_META[a.correct_label]?.color }}>{LABEL_META[a.correct_label]?.name || a.correct_label}</strong>
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: a.is_correct ? '#22D07A' : 'var(--exl-text-muted)' }}>+{a.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => { play('coin'); submitFinal() }} className="exl-btn-primary"
                style={{ marginTop: '24px', padding: '12px 32px', fontSize: '15px', fontWeight: 700, width: '100%' }}>
                <TrophyIcon s={16} c="#fff" /> View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* ═══ LEADERBOARD ═══ */}
        {phase === 'leaderboard' && (
          <div className="phase-lb-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start', padding: '40px 60px', maxWidth: '1100px', margin: '0 auto', width: '100%', overflow: 'auto' }}>
            {/* Player summary */}
            <div className="g-card lb-player-card" style={{ padding: '32px', textAlign: 'center' }}>
              <CameraIcon s={36} c={ORANGE} />
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--exl-text)', fontFamily: "'Oswald', sans-serif", marginTop: '10px' }}>
                {playerName}
              </div>
              <div style={{ fontSize: '13px', color: ORANGE, fontWeight: 700, marginTop: '4px' }}>{getRankTitle(score)}</div>
              <div className="lb-player-score" style={{ fontSize: '48px', fontWeight: 800, color: ORANGE, fontFamily: "'Oswald', sans-serif", margin: '12px 0' }}>
                {score.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--exl-text-muted)' }}>
                {answers.filter(a => a.is_correct).length}/{answers.length} correct
                {' '}&middot;{' '}
                {answers.length > 0 ? Math.round((answers.filter(a => a.is_correct).length / answers.length) * 100) : 0}% accuracy
                {' '}&middot;{' '}
                Best streak: {bestStreak}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button onClick={() => {
                  play('click')
                  setCurrentIdx(0); setAnswers([]); setScore(0); setStreak(0); setBestStreak(0)
                  setTimeLeft(TIME_PER_IMAGE); setTimerActive(false); setImgLoaded(false)
                  // Reshuffle
                  fetch(`${API_BASE_URL}/api/image-game/images`).then(r => r.ok ? r.json() : []).then(imgs => {
                    setImages(imgs); setPhase('name')
                  }).catch(() => setPhase('name'))
                }} className="exl-btn-primary" style={{ flex: 1, padding: '10px' }}>
                  Play Again
                </button>
                <button onClick={() => { play('click'); setPhase('welcome') }} className="exl-btn-ghost" style={{ flex: 1, padding: '10px' }}>
                  Back to Menu
                </button>
              </div>
            </div>

            {/* Full leaderboard */}
            <div className="g-card" style={{ padding: '20px 24px', maxHeight: '600px', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <TrophyIcon s={16} c={ORANGE} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--exl-text)', letterSpacing: '0.04em' }}>TOP DETECTIVES</span>
              </div>
              {lb.map((e, i) => {
                const isMe = e.player_name === playerName && Math.abs(e.score - score) < 5
                const key = lbKey(e)
                const delta = posChanges.get(key) || 0
                return (
                  <div key={e.id ?? `${e.player_name}-${i}`} className="lb-row" style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px',
                    background: isMe ? `${ORANGE}15` : delta > 0 ? 'rgba(16,185,129,0.08)' : delta < 0 ? 'rgba(239,68,68,0.06)' : i < 3 ? `rgba(255,107,53,${0.06 - i * 0.015})` : 'transparent',
                    border: isMe ? `1px solid ${ORANGE}40` : delta !== 0 ? `1px solid ${delta > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}` : '1px solid transparent',
                    animation: delta !== 0 ? 'lbSlideIn .5s ease both' : `stagger1 .3s ease both`,
                    animationDelay: delta !== 0 ? '0s' : `${0.05 + i * 0.06}s`,
                    transition: 'background .4s ease, border .4s ease',
                  }}>
                    <span style={{ width: '28px', fontSize: '11px', fontWeight: 700, color: i < 3 ? ORANGE : 'var(--exl-text-muted)', textAlign: 'center' }}>
                      #{i + 1}
                    </span>
                    {delta !== 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, minWidth: '32px', textAlign: 'center',
                        color: delta > 0 ? '#10b981' : '#ef4444',
                        animation: 'lbBadgePop .4s ease both',
                      }}>
                        {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isMe ? ORANGE : 'var(--exl-text)' }}>{e.player_name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--exl-text-muted)' }}>{e.images_played} imgs</span>
                    <span style={{ fontSize: '10px', color: 'var(--exl-text-muted)' }}>{Math.round(e.accuracy * 100)}%</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: ORANGE, fontFamily: "'Oswald', sans-serif", minWidth: '50px', textAlign: 'right' }}>{e.score.toLocaleString()}</span>
                  </div>
                )
              })}
              {lb.length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--exl-text-muted)', textAlign: 'center', padding: '30px 0' }}>Empty leaderboard</div>
              )}
            </div>
          </div>
        )}

      </div>
    </SoundCtx.Provider>
  )
}
