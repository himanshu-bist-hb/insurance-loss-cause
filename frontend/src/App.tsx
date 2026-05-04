import { useState, useRef } from 'react'
import './App.css'
import ClaimForm from './components/ClaimForm'
import AgentsPage from './components/AgentsPage'
import type { StreamEvent } from './components/AgentStream'
import ResultsView from './components/ResultsView'
import Header from './components/Header'
import { type ClaimEntry } from './components/ActivityLogPanel'
import AgentMonitoringPanel from './components/AgentMonitoringPanel'
import PolicyDetailsPage from './components/PolicyDetailsPage'
import LoginPage from './components/LoginPage'
import AdjusterDashboard from './components/AdjusterDashboard'
import PolicyOwnerDashboard from './components/PolicyOwnerDashboard'
import ConfirmationModal from './components/ConfirmationModal'
import PolicyOwnerClaimForm from './components/PolicyOwnerClaimForm'
import HomePage from './components/HomePage'
import DevHomePage from './components/DevHomePage'
import ModelTestPage from './components/ModelTestPage'
import AdminDashboard from './components/AdminDashboard'
import GamePage from './components/GamePage'
import ImageGamePage from './components/ImageGamePage'
import { API_BASE_URL } from './config'

interface AgentResult {
  agent: string
  status: 'completed' | 'error'
  findings: Record<string, unknown>
}

interface Verdict {
  fraud_probability: number
  fraud_verdict: 'APPROVE' | 'FLAG' | 'REJECT'
  loss_cause_primary: string
  loss_cause_secondary?: string
  loss_cause_tertiary?: string
  loss_cause_confidence?: number
  completeness_score?: number
  reasoning: string
  human_review_required: boolean
  processing_time_seconds?: number
  agent_risk_levels?: Record<string, string>
}

interface User {
  id: number
  email: string
  role: 'policyholder' | 'adjuster' | 'admin'
  name: string
}

type Tab = 'homepage' | 'policy_details' | 'form' | 'processing' | 'results'
  | 'ph_dashboard' | 'adj_dashboard' | 'ph_claim_form' | 'admin_dashboard'

// SVG Icons


const ProcessingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const ResultsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)


function App() {
  // Auth state — persisted to sessionStorage
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem('authToken'))
  const [user, setUser] = useState<User | null>(() => {
    const raw = sessionStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (!user) return 'homepage'
    return user.role === 'admin' ? 'admin_dashboard' : user.role === 'adjuster' ? 'adj_dashboard' : 'ph_dashboard'
  })
  const [claimId, setClaimId] = useState<string | null>(null)
  const [claimData, setClaimData] = useState<Record<string, unknown>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const activeWebSocket = useRef<WebSocket | null>(null)
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([])
  const [agentResults, setAgentResults] = useState<AgentResult[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)

  // Panel state
  const [activePanel, setActivePanel] = useState<'monitoring' | null>(null)
  const [claimHistory, setClaimHistory] = useState<ClaimEntry[]>([])

  // Policy state
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [selectedPolicyData, setSelectedPolicyData] = useState<any>(null)

  // Policyholder confirmation modal
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null)

  // ── Auth handlers ──

  const handleLogin = (token: string, userData: { id: number; email: string; role: string; name: string }) => {
    setAuthToken(token)
    const u = userData as User
    setUser(u)
    sessionStorage.setItem('authToken', token)
    sessionStorage.setItem('user', JSON.stringify(u))
    setActiveTab(u.role === 'admin' ? 'admin_dashboard' : u.role === 'adjuster' ? 'adj_dashboard' : 'ph_dashboard')
  }

  const handleLogout = () => {
    setAuthToken(null)
    setUser(null)
    sessionStorage.removeItem('authToken')
    sessionStorage.removeItem('user')
    setActiveTab('homepage')
    setClaimId(null)
    setClaimData({})
    setVerdict(null)
    setStreamEvents([])
    setAgentResults([])
    setIsProcessing(false)
    setSelectedPolicyId(null)
    setSelectedPolicyData(null)
  }

  // Dev homepage route — Concept 1 isometric scene + persona login
  if (window.location.pathname === '/dev-homepage') {
    return <DevHomePage onLogin={handleLogin} />
  }

  // Model test page — no auth required
  if (window.location.pathname === '/test-model') {
    return <ModelTestPage onBack={() => { window.location.pathname = '/' }} />
  }

  // Game page — public, no auth required
  if (window.location.pathname === '/game') {
    return <GamePage onBack={() => { window.location.pathname = '/' }} />
  }

  // Image Detective game — public, no auth required
  if (window.location.pathname === '/quick-game') {
    return <ImageGamePage onBack={() => { window.location.pathname = '/' }} />
  }

  // Admin login — separate route
  if (window.location.pathname === '/admin') {
    if (authToken && user && user.role === 'admin') {
      // Already logged in as admin — redirect to main app
      window.location.pathname = '/'
      return null
    }
    return <LoginPage onLogin={(token, userData) => { handleLogin(token, userData); window.location.pathname = '/' }} adminOnly />
  }

  // If not logged in, show login page
  if (!authToken || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const addStreamEvent = (event: StreamEvent) => {
    setStreamEvents(prev => [...prev, event])
  }

  // ── Adjuster: run analysis on a claim ──
  const handleRunAnalysis = (targetClaimId: string) => {
    // Close any previous SSE connection
    if (activeWebSocket.current) {
      activeWebSocket.current.close()
      activeWebSocket.current = null
    }

    setClaimId(targetClaimId)
    setVerdict(null)
    setStreamEvents([])
    setAgentResults([])
    setIsProcessing(true)
    setActiveTab('processing')

    addStreamEvent({
      timestamp: new Date().toLocaleTimeString(),
      agent: 'orchestrator',
      type: 'thinking',
      content: `Starting analysis for claim ${targetClaimId}...`
    })

    const ws = createClaimWS(targetClaimId, { force: true })
    activeWebSocket.current = ws
    ws.onopen = () => wireWebSocket(ws, targetClaimId)
  }

  // ── Adjuster: view in-progress analysis (subscribe without re-running) ──
  const handleViewProgress = async (targetClaimId: string) => {
    // If we're already streaming this claim in this session, just switch tab
    if (claimId === targetClaimId && isProcessing) {
      setActiveTab('processing')
      return
    }

    // Check backend status
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/${targetClaimId}/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const status = await res.json()
        if (status.status === 'completed' && !status.live) {
          // Done and no live pipeline — load saved report
          await handleViewReport(targetClaimId, 'processing')
          return
        }
      }
    } catch { /* ignore, fall through to subscribe */ }

    // Subscribe to existing pipeline (or auto-start if needed) — no force
    if (activeWebSocket.current) {
      activeWebSocket.current.close()
      activeWebSocket.current = null
    }

    setClaimId(targetClaimId)
    setVerdict(null)
    setStreamEvents([])
    setAgentResults([])
    setIsProcessing(true)
    setActiveTab('processing')

    addStreamEvent({
      timestamp: new Date().toLocaleTimeString(),
      agent: 'orchestrator',
      type: 'thinking',
      content: `Connecting to analysis for claim ${targetClaimId}...`
    })

    const ws = createClaimWS(targetClaimId)
    activeWebSocket.current = ws
    ws.onopen = () => wireWebSocket(ws, targetClaimId)
  }

  // ── Adjuster: view saved report ──
  const handleViewReport = async (targetClaimId: string, forceTab?: Tab) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/claims/${targetClaimId}/report`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) return

      const report = await res.json()

      // Reconstruct state from saved report
      setClaimId(targetClaimId)
      setIsProcessing(false)

      // Parse saved events
      let savedEvents: StreamEvent[] = []
      if (report.stream_events_json) {
        try {
          const raw = typeof report.stream_events_json === 'string'
            ? JSON.parse(report.stream_events_json)
            : report.stream_events_json
          savedEvents = raw.map((e: any) => {
            const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data || {}
            const evType = e.event as string
            // Determine event type
            let type: StreamEvent['type'] = 'tool_use'
            if (evType === 'agent_reasoning' || evType === 'agent_reasoning_stream') {
              type = 'reasoning'
            } else if (data.status === 'completed') {
              type = 'result'
            } else if (data.status === 'thinking') {
              type = 'thinking'
            }
            // Determine content
            let content = data.message || data.reasoning || ''
            if (evType === 'agent_reasoning_stream') {
              content = data.token || ''
            }
            return {
              timestamp: data.timestamp || '',
              agent: data.agent || '',
              type,
              content,
              data: data.findings || data.details || undefined,
            }
          })
          // Consolidate reasoning events: merge all per-agent reasoning chunks into one event
          const reasoningByAgent: Record<string, string> = {}
          savedEvents.forEach(ev => {
            if (ev.type === 'reasoning' && ev.agent) {
              reasoningByAgent[ev.agent] = (reasoningByAgent[ev.agent] || '') + ev.content
            }
          })
          const seenAgent: Record<string, boolean> = {}
          savedEvents = savedEvents.filter(ev => {
            if (ev.type !== 'reasoning') return true
            if (seenAgent[ev.agent]) return false
            seenAgent[ev.agent] = true
            ev.content = reasoningByAgent[ev.agent] || ev.content
            return true
          })
        } catch { /* ignore */ }
      }
      setStreamEvents(savedEvents)

      // Parse verdict
      let savedVerdict: Verdict | null = null
      if (report.verdict_json) {
        try {
          savedVerdict = typeof report.verdict_json === 'string'
            ? JSON.parse(report.verdict_json)
            : report.verdict_json
        } catch { /* ignore */ }
      }
      setVerdict(savedVerdict)

      // Parse agent results — identify agent by examining findings keys
      let savedResults: AgentResult[] = []
      if (report.agent_results_json) {
        try {
          const raw = typeof report.agent_results_json === 'string'
            ? JSON.parse(report.agent_results_json)
            : report.agent_results_json
          savedResults = (raw as any[]).map((r: any) => {
            let agent = r.agent || ''
            if (!agent) {
              if (r.primary_cause || r.primary_loss_cause) agent = 'loss_cause'
              else if (r.ml_fraud_probability !== undefined) agent = 'structured'
              else if (r.risk_score !== undefined && r.findings) agent = 'document'
              else if (r.ai_classification !== undefined) agent = 'visual'
              else if (r.web_risk_signal !== undefined) agent = 'web_search'
              else if (r.fraud_ring_risk_score !== undefined) agent = 'fraud_ring'
            }
            return { agent, status: 'completed' as const, findings: r }
          })
        } catch { /* ignore */ }
      }
      setAgentResults(savedResults)

      // Load claim data for results view
      try {
        const claimRes = await fetch(`${API_BASE_URL}/api/claims/${targetClaimId}/detail`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (claimRes.ok) {
          const claim = await claimRes.json()
          setClaimData(claim)
        }
      } catch { /* ignore */ }

      setActiveTab(forceTab ?? (savedVerdict ? 'results' : 'processing'))
    } catch {
      /* ignore */
    }
  }

  // ── Upload files and return server paths ──
  const uploadEvidence = async (formData: FormData): Promise<{ imagePaths: string[], pdfPaths: string[] }> => {
    const imageFiles: File[] = []
    const pdfFiles: File[] = []
    formData.forEach((value, key) => {
      if (value instanceof File) {
        if (key === 'Claim_Image' || value.type.startsWith('image')) imageFiles.push(value)
        else if (key === 'Claim_PDF' || value.type === 'application/pdf') pdfFiles.push(value)
      }
    })
    const allFiles = [...imageFiles, ...pdfFiles]
    if (allFiles.length === 0) return { imagePaths: [], pdfPaths: [] }

    const uploadFd = new FormData()
    allFiles.forEach(f => uploadFd.append('files', f))
    const res = await fetch(`${API_BASE_URL}/api/claims/upload-evidence`, { method: 'POST', body: uploadFd })
    const data = await res.json()
    const paths: string[] = data.paths || []

    // Split back into image vs PDF paths based on original order
    const imagePaths = paths.slice(0, imageFiles.length)
    const pdfPaths = paths.slice(imageFiles.length)
    return { imagePaths, pdfPaths }
  }

  // ── Policyholder: submit claim ──
  const handleClaimSubmit = async (formData: FormData) => {
    setIsProcessing(true)
    setVerdict(null)
    setStreamEvents([])
    setAgentResults([])

    // Upload evidence files first (if any)
    let imagePaths: string[] = []
    let pdfPaths: string[] = []
    try {
      const uploaded = await uploadEvidence(formData)
      imagePaths = uploaded.imagePaths
      pdfPaths = uploaded.pdfPaths
    } catch (err) {
      console.warn('File upload failed, continuing without files:', err)
    }

    // Build JSON data from FormData (skip File objects)
    const jsonData: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      if (!(value instanceof File)) jsonData[key] = value
    })
    // Replace file references with server paths
    if (imagePaths.length) jsonData['Claim_Image'] = imagePaths.join(',')
    if (pdfPaths.length) jsonData['Claim_PDF'] = pdfPaths.join(',')

    // Sanitize: remove invalid/stale Claim_Image and Claim_PDF values
    for (const fileKey of ['Claim_Image', 'Claim_PDF']) {
      const v = String(jsonData[fileKey] ?? '').trim().toLowerCase()
      if (!v || v === 'nan' || v === 'undefined' || v === 'null' || v === 'none') {
        delete jsonData[fileKey]
      }
    }
    setClaimData(jsonData)

    if (user.role === 'policyholder') {
      // Policyholder flow: submit and show confirmation
      try {
        const response = await fetch(`${API_BASE_URL}/api/claims/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(jsonData),
        })

        const result = await response.json()
        setSubmittedClaimId(result.claim_id)
        setShowConfirmation(true)
        setIsProcessing(false)
      } catch (error) {
        console.error('Error submitting claim:', error)
        setIsProcessing(false)
      }
      return
    }

    // Adjuster flow: submit + auto-start SSE analysis
    setActiveTab('processing')

    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(jsonData),
      })

      const result = await response.json()
      setClaimId(result.claim_id)

      addStreamEvent({
        timestamp: new Date().toLocaleTimeString(),
        agent: 'orchestrator',
        type: 'thinking',
        content: `Starting analysis for claim ${result.claim_id}...`
      })

      const ws = createClaimWS(result.claim_id)
      activeWebSocket.current = ws
      ws.onopen = () => wireWebSocket(ws, result.claim_id)

    } catch (error) {
      console.error('Error submitting claim:', error)
      addStreamEvent({
        timestamp: new Date().toLocaleTimeString(), agent: 'system', type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to submit claim'}`
      })
      setIsProcessing(false)
    }
  }

  // ── WebSocket helpers ──
  function createClaimWS(claimId: string, opts?: { force?: boolean }): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws')
    const params = new URLSearchParams()
    if (authToken) params.set('token', authToken)
    if (opts?.force) params.set('force', 'true')
    return new WebSocket(`${wsUrl}/api/stream/ws/${claimId}?${params}`)
  }

  function wireWebSocket(ws: WebSocket, targetClaimId: string) {
    ws.onmessage = (messageEvent) => {
      const msg = JSON.parse(messageEvent.data)
      const eventType: string = msg.event

      if (eventType === 'ping' || eventType === 'flush') return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
      try {
        data = typeof msg.data === 'string' && msg.data ? JSON.parse(msg.data) : (msg.data || {})
      } catch { data = {} }

      if (eventType === 'agent_update') {
        const typeMap: Record<string, StreamEvent['type']> = {
          'thinking': 'thinking', 'processing': 'tool_use', 'completed': 'result', 'error': 'error', 'reasoning': 'reasoning'
        }
        addStreamEvent({
          timestamp: new Date().toLocaleTimeString(),
          agent: data.agent,
          type: typeMap[data.status] || 'thinking',
          content: data.message,
          data: data.findings
        })
        if (data.status === 'completed') {
          setAgentResults(prev => [
            ...prev.filter(r => r.agent !== data.agent),
            { agent: data.agent, status: 'completed', findings: data.findings || {} }
          ])
        }

      } else if (eventType === 'agent_reasoning') {
        addStreamEvent({
          timestamp: new Date().toLocaleTimeString(),
          agent: data.agent,
          type: 'reasoning',
          content: data.reasoning,
          data: data.details
        })

      } else if (eventType === 'loss_cause_input_data') {
        addStreamEvent({
          timestamp: new Date().toLocaleTimeString(),
          agent: 'loss_cause',
          type: 'tool_use',
          content: 'Claim input data loaded',
          data: { _input_data_early: data.input_data }
        })

      } else if (eventType === 'agent_reasoning_stream') {
        setStreamEvents(prev => {
          const last = prev[prev.length - 1]
          if (last && last.agent === data.agent && last.type === 'reasoning') {
            const newLast = { ...last, content: last.content + data.token, data: { ...last.data, streaming: true } }
            return [...prev.slice(0, -1), newLast]
          }
          return [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            agent: data.agent, type: 'reasoning', content: data.token, data: { streaming: true }
          }]
        })

      } else if (eventType === 'processing_complete') {
        addStreamEvent({
          timestamp: new Date().toLocaleTimeString(),
          agent: 'adjudicator', type: 'result',
          content: `Analysis complete. Verdict: ${data.verdict.fraud_verdict}`,
          data: data.verdict
        })
        const v: Verdict = data.verdict
        setVerdict(v)
        setIsProcessing(false)
        ws.close()
        activeWebSocket.current = null
        setActiveTab('results')
        // Refresh claimData from backend so all fields (claim_amount, etc.) are populated
        fetch(`${API_BASE_URL}/api/claims/${targetClaimId}/detail`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        })
          .then(r => r.ok ? r.json() : null)
          .then(full => { if (full) setClaimData(full) })
          .catch(() => {})
        setClaimHistory(prev => [...prev, {
          claim_id: targetClaimId,
          timestamp: new Date().toLocaleTimeString(),
          verdict: v.fraud_verdict,
          fraud_probability: v.fraud_probability * 100,
          loss_cause_primary: v.loss_cause_primary,
          loss_cause_secondary: v.loss_cause_secondary,
          loss_cause_confidence: v.loss_cause_confidence,
        }])

      } else if (eventType === 'error') {
        addStreamEvent({
          timestamp: new Date().toLocaleTimeString(),
          agent: 'system', type: 'error',
          content: data.message || data.error || 'An error occurred'
        })
      }
    }

    ws.onerror = () => { setIsProcessing(false); ws.close(); activeWebSocket.current = null }
    ws.onclose = () => { if (activeWebSocket.current === ws) activeWebSocket.current = null }
  }

  // ── Navigation helpers ──

  const handleNewClaim = () => {
    setClaimId(null)
    setClaimData({})
    setVerdict(null)
    setStreamEvents([])
    setAgentResults([])
    setIsProcessing(false)
    setSelectedPolicyId(null)
    setSelectedPolicyData(null)
    setActiveTab(user.role === 'admin' ? 'admin_dashboard' : user.role === 'adjuster' ? 'adj_dashboard' : 'ph_dashboard')
  }

  const handleGoHome = () => {
    setActiveTab(user.role === 'admin' ? 'admin_dashboard' : user.role === 'adjuster' ? 'adj_dashboard' : 'ph_dashboard')
    setSelectedPolicyId(null)
    setSelectedPolicyData(null)
  }

  const handlePolicySelected = (policyId: string, policyData: any) => {
    setSelectedPolicyId(policyId)
    setSelectedPolicyData(policyData)
    setActiveTab('policy_details')
  }

  const handleSubmitFromPolicy = () => {
    setActiveTab(user.role === 'policyholder' ? 'ph_claim_form' : 'form')
  }

  const handleBackToHome = () => {
    setActiveTab(user.role === 'admin' ? 'admin_dashboard' : user.role === 'adjuster' ? 'adj_dashboard' : 'ph_dashboard')
    setSelectedPolicyId(null)
    setSelectedPolicyData(null)
  }

  // ── Tab bar (only for adjuster analysis flow) ──
  const DashboardIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  )
  const tabs = [
    { id: 'adj_dashboard' as Tab, label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'processing' as Tab, label: 'Agent Processing', icon: <ProcessingIcon /> },
    { id: 'results' as Tab, label: 'Results', icon: <ResultsIcon />, disabled: !verdict },
  ]

  // Show tabs only in analysis flow (or adj_dashboard when coming back)
  const analysisFlow = ['adj_dashboard', 'processing', 'results'].includes(activeTab)
  const showTabs = analysisFlow

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — visible when logged in, hidden on homepage */}
      {activeTab !== 'homepage' && (
        <Header
          onLogoClick={handleGoHome}
          userName={user.name}
          userRole={user.role}
          onLogout={handleLogout}
          onAgentMonitoring={() => setActivePanel('monitoring')}
          showAgentMonitoringButton={activeTab === 'processing' && activePanel !== 'monitoring'}
        />
      )}

      {/* Tab Navigation — only in analysis flow */}
      {showTabs && (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6">
            <nav className="flex gap-1">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : tab.disabled
                        ? 'border-transparent text-gray-300 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {index < tabs.length - 1 && (
                    <span className="ml-2 text-gray-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ── HOMEPAGE ── */}
      {activeTab === 'homepage' && (
        <HomePage onPolicySelected={handlePolicySelected} onGoToDashboard={() => setActiveTab('adj_dashboard')} />
      )}

      {/* ── ADJUSTER DASHBOARD ── */}
      {activeTab === 'adj_dashboard' && (
        <AdjusterDashboard
          authToken={authToken}
          onRunAnalysis={handleRunAnalysis}
          onViewReport={handleViewReport}
          onViewProgress={handleViewProgress}
        />
      )}

      {/* ── ADMIN DASHBOARD ── */}
      {activeTab === 'admin_dashboard' && (
        <AdminDashboard authToken={authToken} />
      )}

      {/* ── POLICYHOLDER DASHBOARD ── */}
      {activeTab === 'ph_dashboard' && (
        <PolicyOwnerDashboard
          authToken={authToken}
          userName={user.name}
          onPolicyClick={handlePolicySelected}
        />
      )}

      {/* Policy Details */}
      {activeTab === 'policy_details' && selectedPolicyId && selectedPolicyData && (
        <PolicyDetailsPage
          policyId={selectedPolicyId}
          policyData={selectedPolicyData}
          onSubmitNewClaim={handleSubmitFromPolicy}
          onBack={handleBackToHome}
          userRole={user.role}
        />
      )}

      {/* ── POLICYHOLDER CLAIM FORM (2-step with LLM pre-fill) ── */}
      {activeTab === 'ph_claim_form' && selectedPolicyData && authToken && (
        <PolicyOwnerClaimForm
          policyData={selectedPolicyData}
          authToken={authToken}
          onSubmit={handleClaimSubmit}
          onBack={() => setActiveTab('policy_details')}
        />
      )}

      {/* Tab 1: Claim Form */}
      <main className="w-full" style={{ display: activeTab === 'form' ? 'block' : 'none' }}>
        <ClaimForm onSubmit={handleClaimSubmit} isProcessing={isProcessing} initialPolicyData={selectedPolicyData} />
      </main>

      {/* Tab 2: Agent Processing */}
      <main className="w-full" style={{ display: activeTab === 'processing' ? 'block' : 'none' }}>
        <div style={{ height: 'calc(100vh - 120px)' }}>
          <AgentsPage
            claimId={claimId}
            isProcessing={isProcessing}
            events={streamEvents}
            verdict={verdict}
            onNewClaim={handleNewClaim}
            onOpenMonitoring={() => setActivePanel('monitoring')}
            authToken={authToken}
          />
        </div>
      </main>

      {/* Tab 3: Results */}
      {verdict && claimId && (
        <main className="max-w-7xl mx-auto px-6 py-6" style={{ display: activeTab === 'results' ? 'block' : 'none' }}>
          <ResultsView
            claimId={claimId}
            claimData={claimData}
            verdict={verdict}
            agentResults={agentResults}
            streamEvents={streamEvents}
            onBack={() => setActiveTab('processing')}
            onNewClaim={handleNewClaim}
          />
        </main>
      )}

      {/* ── Overlay panels ── */}
      <AgentMonitoringPanel
        isOpen={activePanel === 'monitoring'}
        onClose={() => setActivePanel(null)}
        claims={claimHistory}
        isProcessing={isProcessing}
        streamEvents={streamEvents}
      />

      {/* ── Policyholder confirmation modal ── */}
      {showConfirmation && submittedClaimId && (
        <ConfirmationModal
          claimId={submittedClaimId}
          onClose={() => {
            setShowConfirmation(false)
            setSubmittedClaimId(null)
            setActiveTab('ph_dashboard')
          }}
        />
      )}
    </div>
  )
}

export default App
