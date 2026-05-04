/**
 * Admin Dashboard — View, add (manual or CSV/XLSX), and delete policy entries.
 * File upload flow: select file → parse → review/edit in table → push to DB.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'

interface PolicyRow {
  policy_id: string
  claim_id: string
  policy_type?: string
  claimant_name?: string
  email_id?: string
  customer_region?: string
  vehicle_make?: string
  vehicle_model?: string
  claim_amount?: number
  'ML Fraud Probability'?: number
  [key: string]: unknown
}

interface FormOptions {
  garages: string[]
  brokers: string[]
  channels: string[]
  weather: string[]
  impact_points: string[]
  injury_types: string[]
  policy_types: string[]
  customer_regions: string[]
  customer_occupations: string[]
  customer_genders: string[]
  vehicle_makes: string[]
  vehicle_models: string[]
  ownership_types: string[]
  usage_types: string[]
  loss_causes: string[]
}

interface GameCaseRow {
  claim_id: string
  policy_id: string
  claim_amount: number | null
  fraud_verdict?: string
  fraud_probability?: number
  loss_cause_primary?: string
  summary_text?: string
  completed_at: string
  in_game: boolean
}

interface AdminDashboardProps {
  authToken: string
}

// Pretty display names for columns
const COL_LABELS: Record<string, string> = {
  policy_id: 'Policy ID', policy_type: 'Type', policy_start_date: 'Start Date',
  policy_end_date: 'End Date', policy_premium_amount: 'Premium', no_claim_bonus_percent: 'NCB %',
  number_of_past_claims: 'Past Claims', customer_id: 'Cust ID', claimant_name: 'Name',
  customer_age: 'Age', customer_gender: 'Gender', customer_occupation: 'Occupation',
  customer_region: 'Region', claimant_mobile_number: 'Mobile', email_id: 'Email',
  vehicle_identification_number: 'VIN', vehicle_make: 'Make', vehicle_model: 'Model',
  vehicle_year: 'Year', vehicle_value_estimate: 'Value Est.', vehicle_ownership_type: 'Ownership',
  vehicle_usage_type: 'Usage', vehicle_registration_number: 'Reg #', odometer_reading: 'Odometer',
  claim_date: 'Claim Date', claim_report_date: 'Report Date', claim_amount: 'Claim Amt',
  approved_amount: 'Approved Amt', loss_cause: 'Loss Cause', submission_channel: 'Channel',
  initial_point_of_impact: 'Impact Point', injury_type: 'Injury Type',
  witness_present: 'Witness', police_report_filed: 'Police Report',
  driver_at_fault: 'At Fault', driver_license_age_years: 'License Age',
  passengers_in_vehicle: 'Passengers', passengers_other_vehicle: 'Pass. (other)',
  repair_cost_estimate: 'Repair Cost', repair_duration_days: 'Repair Days',
  towed_from_scene: 'Towed', garage_name: 'Garage', broker_name: 'Broker',
  weather_condition: 'Weather', accident_location_zip: 'ZIP',
}

const REQUIRED_COLS = ['policy_id', 'claimant_name', 'email_id']

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px',
}
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle', fontSize: '13px', color: '#374151',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px',
  border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, backgroundColor: '#fff' }
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280',
  marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px',
}
const sectionHeader: React.CSSProperties = {
  fontSize: '13px', fontWeight: 700, color: '#1f2937',
  marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb',
}

export default function AdminDashboard({ authToken }: AdminDashboardProps) {
  // Dashboard tab
  const [dashTab, setDashTab] = useState<'policies' | 'game_cases' | 'image_game'>('policies')

  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PolicyRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')

  // Add modal: 'manual' | 'upload'
  const [addMode, setAddMode] = useState<'manual' | 'upload'>('manual')

  // Upload multi-step: 'select' | 'review' | 'done'
  const [uploadStep, setUploadStep] = useState<'select' | 'review' | 'done'>('select')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  // Parsed data for review/edit
  const [parsedColumns, setParsedColumns] = useState<string[]>([])
  const [missingColumns, setMissingColumns] = useState<string[]>([])
  const [editRows, setEditRows] = useState<Record<string, string>[]>([])
  // Bulk-add result
  const [bulkResult, setBulkResult] = useState<{ added: number; errors: string[] } | null>(null)

  // Manual form state
  const emptyForm: Record<string, string> = {
    policy_id: '', policy_type: 'Comprehensive', policy_start_date: '', policy_end_date: '',
    policy_premium_amount: '', no_claim_bonus_percent: '0', number_of_past_claims: '0',
    customer_id: '', claimant_name: '', customer_age: '', customer_gender: 'Male',
    customer_occupation: '', customer_region: '', claimant_mobile_number: '', email_id: '',
    vehicle_identification_number: '', vehicle_make: '', vehicle_model: '', vehicle_year: '',
    vehicle_value_estimate: '', vehicle_ownership_type: 'Owned', vehicle_usage_type: 'Personal',
    vehicle_registration_number: '', odometer_reading: '',
    claim_date: '', claim_report_date: '', claim_amount: '', approved_amount: '',
    loss_cause: '', submission_channel: '', initial_point_of_impact: '', injury_type: '',
    witness_present: '0', police_report_filed: '0',
    garage_name: '', broker_name: '', weather_condition: 'Clear', accident_location_zip: '',
    driver_at_fault: '0', driver_license_age_years: '', passengers_in_vehicle: '1',
    passengers_other_vehicle: '0', repair_cost_estimate: '', repair_duration_days: '',
    towed_from_scene: '0',
  }
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm })

  useEffect(() => {
    fetchPolicies()
    fetchFormOptions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPolicies = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/policies`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setPolicies(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  const fetchFormOptions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/form-options`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setFormOptions(await res.json())
    } catch { /* ignore */ }
  }

  const handleManualAdd = async () => {
    setSaving(true)
    setApiError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/policies`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { closeAddModal(); await fetchPolicies() }
      else {
        const err = await res.json().catch(() => ({ detail: 'Failed to add policy' }))
        setApiError(err.detail || 'Failed to add policy')
      }
    } catch { setApiError('Network error') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setApiError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/policies/${deleteTarget.policy_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) { setDeleteTarget(null); await fetchPolicies() }
      else {
        const err = await res.json().catch(() => ({ detail: 'Failed to delete policy' }))
        setApiError(err.detail || 'Failed to delete policy')
      }
    } catch { setApiError('Network error') }
    setSaving(false)
  }

  // ── File upload: parse ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFileName(file.name)
    setParsing(true)
    setParseError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/policies/parse-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setParsedColumns(data.columns || [])
        setMissingColumns(data.missing_columns || [])
        setEditRows(data.rows || [])
        setUploadStep('review')
      } else {
        const err = await res.json().catch(() => ({ detail: 'Parse failed' }))
        setParseError(err.detail || 'Failed to parse file')
      }
    } catch {
      setParseError('Network error while parsing file')
    }
    setParsing(false)
    // Reset file input so re-selecting same file works
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Bulk submit edited rows ──
  const handleBulkSubmit = async () => {
    setSaving(true)
    setBulkResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/policies/bulk-add`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editRows }),
      })
      if (res.ok) {
        const result = await res.json()
        setBulkResult({ added: result.added || 0, errors: result.errors || [] })
        setUploadStep('done')
        await fetchPolicies()
      } else {
        const err = await res.json().catch(() => ({ detail: 'Submit failed' }))
        setBulkResult({ added: 0, errors: [err.detail || 'Submit failed'] })
        setUploadStep('done')
      }
    } catch {
      setBulkResult({ added: 0, errors: ['Network error'] })
      setUploadStep('done')
    }
    setSaving(false)
  }

  // ── Edit a cell in the review table ──
  const updateCell = useCallback((rowIdx: number, col: string, value: string) => {
    setEditRows(prev => {
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], [col]: value }
      return next
    })
  }, [])

  // ── Delete a row from the review table ──
  const deleteEditRow = useCallback((rowIdx: number) => {
    setEditRows(prev => prev.filter((_, i) => i !== rowIdx))
  }, [])

  const closeAddModal = () => {
    setShowAddModal(false)
    setForm({ ...emptyForm })
    setAddMode('manual')
    setUploadStep('select')
    setUploadFileName('')
    setParsedColumns([])
    setMissingColumns([])
    setEditRows([])
    setBulkResult(null)
    setParseError('')
  }

  // ── Game Cases state ──
  const [gameCases, setGameCases] = useState<GameCaseRow[]>([])
  const [gameLoading, setGameLoading] = useState(false)
  const [gameSearch, setGameSearch] = useState('')
  const [gameLinkCopied, setGameLinkCopied] = useState(false)
  const [gameDetailClaim, setGameDetailClaim] = useState<string | null>(null)
  const [gameDetail, setGameDetail] = useState<Record<string, any> | null>(null)
  const [gameDetailPolicy, setGameDetailPolicy] = useState<Record<string, any> | null>(null)
  const [gameDetailLoading, setGameDetailLoading] = useState(false)

  const fetchGameCases = useCallback(async () => {
    setGameLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/game-cases`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setGameCases(await res.json())
    } catch { /* ignore */ }
    setGameLoading(false)
  }, [authToken])

  // ── Fraud Detective Leaderboard management ──
  interface GameLbEntry { id: number; player_name: string; score: number; cases_played: number; accuracy: number; played_at: string }
  const [gameLbEntries, setGameLbEntries] = useState<GameLbEntry[]>([])
  const [gameLbLoading, setGameLbLoading] = useState(false)

  const fetchGameLbEntries = useCallback(async () => {
    setGameLbLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/game/leaderboard`)
      if (res.ok) setGameLbEntries(await res.json())
    } catch { /* ignore */ }
    setGameLbLoading(false)
  }, [])

  const removeGameLbEntry = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/game-leaderboard/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setGameLbEntries(prev => prev.filter(e => e.id !== id))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (dashTab === 'game_cases') { fetchGameCases(); fetchGameLbEntries() }
  }, [dashTab, fetchGameCases, fetchGameLbEntries])

  const toggleGameCase = async (claimId: string, currentlyInGame: boolean) => {
    try {
      const method = currentlyInGame ? 'DELETE' : 'POST'
      const res = await fetch(`${API_BASE_URL}/api/admin/game-cases/${claimId}`, {
        method,
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) await fetchGameCases()
    } catch { /* ignore */ }
  }

  const selectedGameCount = gameCases.filter(c => c.in_game).length

  // ── Image Game state ──
  interface ImagePoolEntry { claim_id: string; image_url: string; in_pool: boolean; label?: string; pool_id?: number; ai_classification?: string; ai_confidence_label?: string; ai_probability?: number | null }
  const [imgGameEntries, setImgGameEntries] = useState<ImagePoolEntry[]>([])
  const [imgGameLoading, setImgGameLoading] = useState(false)
  const [imgGameSearch, setImgGameSearch] = useState('')
  const [imgGameLinkCopied, setImgGameLinkCopied] = useState(false)
  const [imgLabelModal, setImgLabelModal] = useState<ImagePoolEntry | null>(null)
  const [imgSelectedLabel, setImgSelectedLabel] = useState<string>('real')

  const fetchImgGameEntries = useCallback(async () => {
    setImgGameLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/image-game-images`, { headers: { Authorization: `Bearer ${authToken}` } })
      if (res.ok) setImgGameEntries(await res.json())
    } catch { /* ignore */ }
    setImgGameLoading(false)
  }, [authToken])

  // ── Leaderboard management ──
  interface LbEntry { id: number; player_name: string; score: number; images_played: number; accuracy: number; played_at: string }
  const [lbEntries, setLbEntries] = useState<LbEntry[]>([])
  const [lbLoading, setLbLoading] = useState(false)

  const fetchLbEntries = useCallback(async () => {
    setLbLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/image-game/leaderboard`)
      if (res.ok) setLbEntries(await res.json())
    } catch { /* ignore */ }
    setLbLoading(false)
  }, [])

  const removeLbEntry = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/image-game-leaderboard/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setLbEntries(prev => prev.filter(e => e.id !== id))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (dashTab === 'image_game') { fetchImgGameEntries(); fetchLbEntries() }
  }, [dashTab, fetchImgGameEntries, fetchLbEntries])

  const imgPoolCount = imgGameEntries.filter(e => e.in_pool).length

  const addImageToPool = async (imageUrl: string, label: string, claimId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/image-game-images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, label, claim_id: claimId }),
      })
      if (res.ok) await fetchImgGameEntries()
    } catch { /* ignore */ }
  }

  const removeImageFromPool = async (poolId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/image-game-images/${poolId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) await fetchImgGameEntries()
    } catch { /* ignore */ }
  }

  const filteredImgGame = useMemo(() => {
    if (!imgGameSearch.trim()) return imgGameEntries
    const q = imgGameSearch.toLowerCase()
    return imgGameEntries.filter(e =>
      (e.claim_id || '').toLowerCase().includes(q) ||
      (e.label || '').toLowerCase().includes(q) ||
      (e.image_url || '').toLowerCase().includes(q)
    )
  }, [imgGameEntries, imgGameSearch])

  const filteredGameCases = useMemo(() => {
    if (!gameSearch.trim()) return gameCases
    const q = gameSearch.toLowerCase()
    return gameCases.filter(c =>
      (c.claim_id || '').toLowerCase().includes(q) ||
      (c.policy_id || '').toLowerCase().includes(q) ||
      (c.loss_cause_primary || '').toLowerCase().includes(q)
    )
  }, [gameCases, gameSearch])

  const openGameDetail = async (claimId: string, policyId: string) => {
    setGameDetailClaim(claimId)
    setGameDetail(null)
    setGameDetailPolicy(null)
    setGameDetailLoading(true)
    try {
      const [claimRes, policyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/claims/${claimId}/detail`, { headers: { Authorization: `Bearer ${authToken}` } }),
        policyId ? fetch(`${API_BASE_URL}/api/policies/${policyId}`) : Promise.resolve(null),
      ])
      if (claimRes.ok) setGameDetail(await claimRes.json())
      if (policyRes && policyRes.ok) setGameDetailPolicy(await policyRes.json())
    } catch { /* ignore */ }
    setGameDetailLoading(false)
  }

  const copyGameLink = () => {
    const url = `${window.location.origin}/game`
    navigator.clipboard.writeText(url).then(() => {
      setGameLinkCopied(true)
      setTimeout(() => setGameLinkCopied(false), 2000)
    })
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return policies
    const q = search.toLowerCase()
    return policies.filter(p =>
      (p.policy_id || '').toLowerCase().includes(q) ||
      (p.claim_id || '').toLowerCase().includes(q) ||
      (p.claimant_name || '').toLowerCase().includes(q) ||
      (p.email_id || '').toLowerCase().includes(q)
    )
  }, [policies, search])

  const setField = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      {/* Dashboard Tab Switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
        {([['policies', 'Policies'], ['game_cases', 'Game Cases'], ['image_game', 'Image Game']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setDashTab(key)} style={{
            padding: '12px 28px', fontSize: '14px', fontWeight: 600,
            color: dashTab === key ? ORANGE : '#6b7280',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: dashTab === key ? `2px solid ${ORANGE}` : '2px solid transparent',
            marginBottom: '-2px',
          }}>
            {label}
            {key === 'game_cases' && selectedGameCount > 0 && (
              <span style={{
                marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                backgroundColor: dashTab === key ? `${ORANGE}15` : '#f3f4f6',
                color: dashTab === key ? ORANGE : '#6b7280',
              }}>{selectedGameCount}</span>
            )}
            {key === 'image_game' && imgPoolCount > 0 && (
              <span style={{
                marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                backgroundColor: dashTab === key ? `${ORANGE}15` : '#f3f4f6',
                color: dashTab === key ? ORANGE : '#6b7280',
              }}>{imgPoolCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ POLICIES TAB ═══ */}
      {dashTab === 'policies' && <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Policy Management</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
            {policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} total
            {search && ` · ${filtered.length} matching`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text" placeholder="Search policies..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '8px', width: '240px', outline: 'none' }}
          />
          <button onClick={fetchPolicies} style={{
            padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
            backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
          }}>Refresh</button>
          <button onClick={() => setShowAddModal(true)} style={{
            padding: '8px 20px', fontSize: '13px', fontWeight: 600, color: '#fff',
            backgroundColor: ORANGE, border: 'none', borderRadius: '8px', cursor: 'pointer',
            boxShadow: `0 2px 8px ${ORANGE}40`,
          }}>+ Add Policy</button>
        </div>
      </div>

      {/* ── Main Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading policies...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          {search ? 'No policies match your search.' : 'No policies found.'}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Policy ID</th>
                  <th style={thStyle}>Claim ID</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Region</th>
                  <th style={thStyle}>Vehicle</th>
                  <th style={thStyle}>Claim Amt</th>
                  <th style={thStyle}>Fraud Prob</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={`${p.policy_id}-${p.claim_id}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: '#1f2937', fontFamily: 'monospace', fontSize: '12px' }}>{p.policy_id}</span></td>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.claim_id}</span></td>
                    <td style={tdStyle}>{p.policy_type || '-'}</td>
                    <td style={tdStyle}>{p.claimant_name || '-'}</td>
                    <td style={tdStyle}><span style={{ fontSize: '12px', color: '#6b7280' }}>{p.email_id || '-'}</span></td>
                    <td style={tdStyle}>{p.customer_region || '-'}</td>
                    <td style={tdStyle}><span style={{ fontSize: '12px' }}>{[p.vehicle_make, p.vehicle_model].filter(Boolean).join(' ') || '-'}</span></td>
                    <td style={tdStyle}>{p.claim_amount != null ? `$${Number(p.claim_amount).toLocaleString()}` : '-'}</td>
                    <td style={tdStyle}>
                      {p['ML Fraud Probability'] != null ? (() => {
                        const v = Number(p['ML Fraud Probability'])
                        return <span style={{ fontWeight: 600, color: v >= 0.66 ? '#dc2626' : v >= 0.33 ? '#d97706' : '#059669' }}>
                          {v >= 0.66 ? 'High' : v >= 0.33 ? 'Moderate' : 'Low'}
                        </span>
                      })() : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => { setDeleteTarget(p); setApiError('') }} style={{
                        padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: '#dc2626',
                        backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer',
                      }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div onClick={() => !saving && setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '420px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#1f2937' }}>Delete Policy</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
              Are you sure you want to delete policy <strong>{deleteTarget.policy_id}</strong>
              {deleteTarget.claimant_name && <> ({deleteTarget.claimant_name})</>}? This action cannot be undone.
            </p>
            {apiError && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', lineHeight: 1.4 }}>
                {apiError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={saving} style={{
                padding: '8px 18px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
                backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleDelete} disabled={saving} style={{
                padding: '8px 18px', fontSize: '13px', fontWeight: 600, color: '#fff',
                backgroundColor: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Policy Modal ── */}
      {showAddModal && (
        <div onClick={() => !saving && !parsing && closeAddModal()} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px',
              width: addMode === 'upload' && uploadStep === 'review' ? '95vw' : '780px',
              maxWidth: addMode === 'upload' && uploadStep === 'review' ? '1400px' : '780px',
              maxHeight: '92vh', overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '28px',
              transition: 'width 0.2s, max-width 0.2s',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>Add New Policy</h3>
              <button onClick={closeAddModal} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
              {([['manual', 'Manual Entry'], ['upload', 'Upload CSV / XLSX']] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setAddMode(key); setUploadStep('select'); setParseError(''); setBulkResult(null) }} style={{
                  padding: '10px 24px', fontSize: '13px', fontWeight: 600,
                  color: addMode === key ? ORANGE : '#6b7280',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: addMode === key ? `2px solid ${ORANGE}` : '2px solid transparent',
                  marginBottom: '-2px',
                }}>{label}</button>
              ))}
            </div>

            {/* ═══════════════ UPLOAD TAB ═══════════════ */}
            {addMode === 'upload' && (
              <>
                {/* Step 1: Select file */}
                {uploadStep === 'select' && (
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
                      Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. All columns from the current database format are supported.
                      Extra columns will be ignored; missing columns can be filled in the next step.
                    </p>

                    <div onClick={() => fileRef.current?.click()} style={{
                      border: '2px dashed #d1d5db', borderRadius: '10px', padding: '40px',
                      textAlign: 'center', cursor: 'pointer', backgroundColor: '#f9fafb',
                    }}>
                      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} />
                      {parsing ? (
                        <div style={{ fontSize: '14px', color: ORANGE, fontWeight: 600 }}>Parsing {uploadFileName}...</div>
                      ) : (
                        <>
                          <div style={{ color: '#9ca3af', marginBottom: '8px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'inline-block' }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>Click to select a <strong>.csv</strong> or <strong>.xlsx</strong> file</div>
                        </>
                      )}
                    </div>

                    {parseError && (
                      <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                        {parseError}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                      <button onClick={closeAddModal} style={{
                        padding: '9px 20px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
                        backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
                      }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Step 2: Review / Edit table */}
                {uploadStep === 'review' && (
                  <div>
                    {/* Status bar */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                        {editRows.length} row{editRows.length !== 1 ? 's' : ''} from <span style={{ color: ORANGE }}>{uploadFileName}</span>
                      </span>
                      {missingColumns.length > 0 && (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, color: '#92400e',
                          backgroundColor: '#fef3c7', padding: '3px 10px', borderRadius: '12px',
                        }}>
                          {missingColumns.length} missing column{missingColumns.length !== 1 ? 's' : ''} — fill below
                        </span>
                      )}
                      <button onClick={() => { setUploadStep('select'); setEditRows([]); setParsedColumns([]); setMissingColumns([]) }} style={{
                        marginLeft: 'auto', padding: '5px 14px', fontSize: '12px', fontWeight: 600, color: '#6b7280',
                        backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
                      }}>Change File</button>
                    </div>

                    {missingColumns.length > 0 && (
                      <div style={{
                        marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px',
                        backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', lineHeight: 1.5,
                      }}>
                        <strong>Missing columns:</strong> {missingColumns.map(c => COL_LABELS[c] || c).join(', ')}.
                        {' '}These columns are highlighted in orange. Fill in the values or leave blank for defaults.
                      </div>
                    )}

                    {/* Editable table */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'auto', maxHeight: '55vh' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: '11px', minWidth: `${parsedColumns.length * 120 + 60}px` }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            <th style={{
                              padding: '7px 8px', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap',
                              borderBottom: '1px solid #e5e7eb', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 3,
                              minWidth: '40px', textAlign: 'center',
                            }}>#</th>
                            {parsedColumns.map(col => {
                              const isMissing = missingColumns.includes(col)
                              const isRequired = REQUIRED_COLS.includes(col)
                              return (
                                <th key={col} style={{
                                  padding: '7px 8px', fontWeight: 700, whiteSpace: 'nowrap',
                                  borderBottom: '1px solid #e5e7eb', minWidth: '100px',
                                  color: isMissing ? '#92400e' : '#6b7280',
                                  backgroundColor: isMissing ? '#fef3c7' : '#f9fafb',
                                }}>
                                  {COL_LABELS[col] || col}
                                  {isRequired && <span style={{ color: '#dc2626' }}> *</span>}
                                </th>
                              )
                            })}
                            <th style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', minWidth: '50px' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {editRows.map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{
                                padding: '4px 8px', color: '#9ca3af', fontWeight: 600, textAlign: 'center',
                                position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 1,
                                borderRight: '1px solid #e5e7eb',
                              }}>{ri + 1}</td>
                              {parsedColumns.map(col => {
                                const isMissing = missingColumns.includes(col)
                                const isEmpty = !row[col]
                                const isRequiredEmpty = REQUIRED_COLS.includes(col) && isEmpty
                                return (
                                  <td key={col} style={{ padding: '3px 4px' }}>
                                    <input
                                      value={row[col] || ''}
                                      onChange={e => updateCell(ri, col, e.target.value)}
                                      style={{
                                        width: '100%', padding: '4px 6px', fontSize: '11px',
                                        border: isRequiredEmpty ? '1px solid #f87171' : isMissing && isEmpty ? '1px solid #fbbf24' : '1px solid #e5e7eb',
                                        borderRadius: '4px', outline: 'none', boxSizing: 'border-box',
                                        backgroundColor: isRequiredEmpty ? '#fef2f2' : isMissing && isEmpty ? '#fffbeb' : '#fff',
                                      }}
                                    />
                                  </td>
                                )
                              })}
                              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                <button onClick={() => deleteEditRow(ri)} title="Remove row" style={{
                                  background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '14px',
                                  padding: '2px 6px', borderRadius: '4px',
                                }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#9ca3af', marginRight: 'auto' }}>
                        {editRows.length} row{editRows.length !== 1 ? 's' : ''} ready to import
                      </span>
                      <button onClick={closeAddModal} disabled={saving} style={{
                        padding: '9px 20px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
                        backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
                      }}>Cancel</button>
                      <button onClick={handleBulkSubmit} disabled={saving || editRows.length === 0} style={{
                        padding: '9px 24px', fontSize: '13px', fontWeight: 600, color: '#fff',
                        backgroundColor: ORANGE, border: 'none', borderRadius: '8px', cursor: 'pointer',
                        opacity: (saving || editRows.length === 0) ? 0.5 : 1, boxShadow: `0 2px 8px ${ORANGE}40`,
                      }}>{saving ? 'Importing...' : `Import ${editRows.length} Row${editRows.length !== 1 ? 's' : ''}`}</button>
                    </div>
                  </div>
                )}

                {/* Step 3: Done */}
                {uploadStep === 'done' && bulkResult && (
                  <div>
                    <div style={{
                      padding: '20px', borderRadius: '10px', textAlign: 'center', marginBottom: '16px',
                      backgroundColor: bulkResult.added > 0 ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${bulkResult.added > 0 ? '#bbf7d0' : '#fecaca'}`,
                    }}>
                      {bulkResult.added > 0 && (
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                          Successfully imported {bulkResult.added} polic{bulkResult.added !== 1 ? 'ies' : 'y'}
                        </div>
                      )}
                      {bulkResult.errors.length > 0 && (
                        <div style={{ marginTop: bulkResult.added > 0 ? '12px' : 0, textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>
                            {bulkResult.errors.length} error{bulkResult.errors.length !== 1 ? 's' : ''}:
                          </div>
                          <div style={{ maxHeight: '150px', overflow: 'auto', fontSize: '12px', color: '#991b1b', lineHeight: 1.5 }}>
                            {bulkResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                      <button onClick={closeAddModal} style={{
                        padding: '9px 24px', fontSize: '13px', fontWeight: 600, color: '#fff',
                        backgroundColor: ORANGE, border: 'none', borderRadius: '8px', cursor: 'pointer',
                      }}>Done</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════ MANUAL ENTRY TAB ═══════════════ */}
            {addMode === 'manual' && (
              <div>
                {/* Policy Info */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={sectionHeader}>Policy Information</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Policy ID</label>
                      <input style={inputStyle} value={form.policy_id} onChange={e => setField('policy_id', e.target.value)} placeholder="e.g. POL001" />
                    </div>
                    <div>
                      <label style={labelStyle}>Policy Type</label>
                      <select style={selectStyle} value={form.policy_type} onChange={e => setField('policy_type', e.target.value)}>
                        {(formOptions?.policy_types || ['Comprehensive', 'Third Party', 'Third Party Fire & Theft']).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Premium Amount</label>
                      <input style={inputStyle} type="number" value={form.policy_premium_amount} onChange={e => setField('policy_premium_amount', e.target.value)} placeholder="1500" />
                    </div>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input style={inputStyle} type="date" value={form.policy_start_date} onChange={e => setField('policy_start_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input style={inputStyle} type="date" value={form.policy_end_date} onChange={e => setField('policy_end_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>NCB %</label>
                      <input style={inputStyle} type="number" value={form.no_claim_bonus_percent} onChange={e => setField('no_claim_bonus_percent', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Past Claims</label>
                      <input style={inputStyle} type="number" value={form.number_of_past_claims} onChange={e => setField('number_of_past_claims', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={sectionHeader}>Customer Information</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Customer ID</label>
                      <input style={inputStyle} value={form.customer_id} onChange={e => setField('customer_id', e.target.value)} placeholder="Auto-generated if empty" />
                    </div>
                    <div>
                      <label style={labelStyle}>Name</label>
                      <input style={inputStyle} value={form.claimant_name} onChange={e => setField('claimant_name', e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                      <label style={labelStyle}>Age</label>
                      <input style={inputStyle} type="number" value={form.customer_age} onChange={e => setField('customer_age', e.target.value)} placeholder="30" />
                    </div>
                    <div>
                      <label style={labelStyle}>Gender</label>
                      <select style={selectStyle} value={form.customer_gender} onChange={e => setField('customer_gender', e.target.value)}>
                        {(formOptions?.customer_genders || ['Male', 'Female', 'Other']).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Occupation</label>
                      <input style={inputStyle} value={form.customer_occupation} onChange={e => setField('customer_occupation', e.target.value)} placeholder="e.g. Engineer" />
                    </div>
                    <div>
                      <label style={labelStyle}>Region</label>
                      <input style={inputStyle} value={form.customer_region} onChange={e => setField('customer_region', e.target.value)} placeholder="e.g. West" />
                    </div>
                    <div>
                      <label style={labelStyle}>Mobile</label>
                      <input style={inputStyle} value={form.claimant_mobile_number} onChange={e => setField('claimant_mobile_number', e.target.value)} placeholder="000-000-0000" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>Email</label>
                      <input style={inputStyle} type="email" value={form.email_id} onChange={e => setField('email_id', e.target.value)} placeholder="user@example.com" />
                    </div>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={sectionHeader}>Vehicle Information</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>VIN</label>
                      <input style={inputStyle} value={form.vehicle_identification_number} onChange={e => setField('vehicle_identification_number', e.target.value)} placeholder="Vehicle ID" />
                    </div>
                    <div>
                      <label style={labelStyle}>Make</label>
                      <input style={inputStyle} value={form.vehicle_make} onChange={e => setField('vehicle_make', e.target.value)} placeholder="e.g. Toyota" />
                    </div>
                    <div>
                      <label style={labelStyle}>Model</label>
                      <input style={inputStyle} value={form.vehicle_model} onChange={e => setField('vehicle_model', e.target.value)} placeholder="e.g. Camry" />
                    </div>
                    <div>
                      <label style={labelStyle}>Year</label>
                      <input style={inputStyle} type="number" value={form.vehicle_year} onChange={e => setField('vehicle_year', e.target.value)} placeholder="2022" />
                    </div>
                    <div>
                      <label style={labelStyle}>Value Estimate</label>
                      <input style={inputStyle} type="number" value={form.vehicle_value_estimate} onChange={e => setField('vehicle_value_estimate', e.target.value)} placeholder="25000" />
                    </div>
                    <div>
                      <label style={labelStyle}>Ownership</label>
                      <select style={selectStyle} value={form.vehicle_ownership_type} onChange={e => setField('vehicle_ownership_type', e.target.value)}>
                        {(formOptions?.ownership_types || ['Owned', 'Leased', 'Financed']).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Usage</label>
                      <select style={selectStyle} value={form.vehicle_usage_type} onChange={e => setField('vehicle_usage_type', e.target.value)}>
                        {(formOptions?.usage_types || ['Personal', 'Commercial', 'Rideshare']).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Registration #</label>
                      <input style={inputStyle} value={form.vehicle_registration_number} onChange={e => setField('vehicle_registration_number', e.target.value)} placeholder="ABC-123" />
                    </div>
                    <div>
                      <label style={labelStyle}>Odometer</label>
                      <input style={inputStyle} type="number" value={form.odometer_reading} onChange={e => setField('odometer_reading', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>

                {/* Claim Details */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={sectionHeader}>Claim Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Claim Date</label>
                      <input style={inputStyle} type="date" value={form.claim_date} onChange={e => setField('claim_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Report Date</label>
                      <input style={inputStyle} type="date" value={form.claim_report_date} onChange={e => setField('claim_report_date', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Claim Amount</label>
                      <input style={inputStyle} type="number" value={form.claim_amount} onChange={e => setField('claim_amount', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Approved Amount</label>
                      <input style={inputStyle} type="number" value={form.approved_amount} onChange={e => setField('approved_amount', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Loss Cause</label>
                      <select style={selectStyle} value={form.loss_cause} onChange={e => setField('loss_cause', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.loss_causes || []).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Channel</label>
                      <select style={selectStyle} value={form.submission_channel} onChange={e => setField('submission_channel', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.channels || ['Agent', 'Online', 'Phone']).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Point of Impact</label>
                      <select style={selectStyle} value={form.initial_point_of_impact} onChange={e => setField('initial_point_of_impact', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.impact_points || []).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Injury Type</label>
                      <select style={selectStyle} value={form.injury_type} onChange={e => setField('injury_type', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.injury_types || []).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Witness Present</label>
                      <select style={selectStyle} value={form.witness_present} onChange={e => setField('witness_present', e.target.value)}>
                        <option value="0">No</option><option value="1">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Police Report</label>
                      <select style={selectStyle} value={form.police_report_filed} onChange={e => setField('police_report_filed', e.target.value)}>
                        <option value="0">No</option><option value="1">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Driver & Repair */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={sectionHeader}>Driver & Repair</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Driver at Fault</label>
                      <select style={selectStyle} value={form.driver_at_fault} onChange={e => setField('driver_at_fault', e.target.value)}>
                        <option value="0">No</option><option value="1">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>License Age (yrs)</label>
                      <input style={inputStyle} type="number" value={form.driver_license_age_years} onChange={e => setField('driver_license_age_years', e.target.value)} placeholder="5" />
                    </div>
                    <div>
                      <label style={labelStyle}>Passengers (own)</label>
                      <input style={inputStyle} type="number" value={form.passengers_in_vehicle} onChange={e => setField('passengers_in_vehicle', e.target.value)} placeholder="1" />
                    </div>
                    <div>
                      <label style={labelStyle}>Passengers (other)</label>
                      <input style={inputStyle} type="number" value={form.passengers_other_vehicle} onChange={e => setField('passengers_other_vehicle', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Repair Cost Est.</label>
                      <input style={inputStyle} type="number" value={form.repair_cost_estimate} onChange={e => setField('repair_cost_estimate', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Repair Duration (days)</label>
                      <input style={inputStyle} type="number" value={form.repair_duration_days} onChange={e => setField('repair_duration_days', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Towed from Scene</label>
                      <select style={selectStyle} value={form.towed_from_scene} onChange={e => setField('towed_from_scene', e.target.value)}>
                        <option value="0">No</option><option value="1">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Location & Other */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={sectionHeader}>Location & Other</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Garage</label>
                      <select style={selectStyle} value={form.garage_name} onChange={e => setField('garage_name', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.garages || []).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Broker</label>
                      <select style={selectStyle} value={form.broker_name} onChange={e => setField('broker_name', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.brokers || []).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Weather</label>
                      <select style={selectStyle} value={form.weather_condition} onChange={e => setField('weather_condition', e.target.value)}>
                        <option value="">Select...</option>
                        {(formOptions?.weather || ['Clear', 'Rain', 'Fog', 'Snow']).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Accident ZIP</label>
                      <input style={inputStyle} value={form.accident_location_zip} onChange={e => setField('accident_location_zip', e.target.value)} placeholder="e.g. 90210" />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  <button onClick={closeAddModal} disabled={saving} style={{
                    padding: '9px 20px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
                    backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
                  }}>Cancel</button>
                  <button
                    onClick={handleManualAdd}
                    disabled={saving || !form.policy_id.trim() || !form.email_id.trim() || !form.claimant_name.trim()}
                    style={{
                      padding: '9px 24px', fontSize: '13px', fontWeight: 600, color: '#fff',
                      backgroundColor: ORANGE, border: 'none', borderRadius: '8px', cursor: 'pointer',
                      opacity: (saving || !form.policy_id.trim() || !form.email_id.trim() || !form.claimant_name.trim()) ? 0.5 : 1,
                      boxShadow: `0 2px 8px ${ORANGE}40`,
                    }}
                  >{saving ? 'Saving...' : 'Add Policy'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>}

      {/* ═══ GAME CASES TAB ═══ */}
      {dashTab === 'game_cases' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Game Case Management</h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
                Select completed claims to include in the Fraud Detective game
                {selectedGameCount > 0 && (
                  <span style={{
                    marginLeft: '8px', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                    backgroundColor: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0',
                  }}>{selectedGameCount} case{selectedGameCount !== 1 ? 's' : ''} selected</span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text" placeholder="Search claims..." value={gameSearch}
                onChange={e => setGameSearch(e.target.value)}
                style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '8px', width: '220px', outline: 'none' }}
              />
              <button onClick={fetchGameCases} style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#6b7280',
                backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer',
              }}>Refresh</button>
              <button onClick={copyGameLink} style={{
                padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                color: gameLinkCopied ? '#059669' : '#fff',
                backgroundColor: gameLinkCopied ? '#f0fdf4' : ORANGE,
                border: gameLinkCopied ? '1px solid #bbf7d0' : 'none',
                borderRadius: '8px', cursor: 'pointer',
                boxShadow: gameLinkCopied ? 'none' : `0 2px 8px ${ORANGE}40`,
              }}>{gameLinkCopied ? 'Link Copied!' : 'Copy Game Link'}</button>
            </div>
          </div>

          {/* Game Cases Table */}
          {gameLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading completed claims...</div>
          ) : filteredGameCases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              {gameSearch ? 'No claims match your search.' : 'No completed claims found. Process claims through the adjuster flow first.'}
            </div>
          ) : (
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={thStyle}>Claim ID</th>
                      <th style={thStyle}>Policy ID</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Verdict</th>
                      <th style={thStyle}>Fraud %</th>
                      <th style={thStyle}>Loss Cause</th>
                      <th style={thStyle}>Completed</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>In Game</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGameCases.map(c => {
                      const verdictColor = c.fraud_verdict === 'SIU' || c.fraud_verdict === 'REJECT' || c.fraud_verdict === 'DECLINE'
                        ? '#dc2626' : c.fraud_verdict === 'AUTO APPROVE' || c.fraud_verdict === 'APPROVE' ? '#059669' : '#d97706'
                      return (
                        <tr key={c.claim_id} style={{
                          borderBottom: '1px solid #f3f4f6',
                          borderLeft: c.in_game ? '3px solid #059669' : '3px solid transparent',
                        }}>
                          <td style={tdStyle}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
                              {c.claim_id}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.policy_id || '-'}</span>
                          </td>
                          <td style={tdStyle}>
                            {c.claim_amount != null ? `$${Number(c.claim_amount).toLocaleString()}` : '-'}
                          </td>
                          <td style={tdStyle}>
                            {c.fraud_verdict ? (
                              <span style={{
                                padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                color: verdictColor, backgroundColor: `${verdictColor}10`,
                              }}>{c.fraud_verdict}</span>
                            ) : '-'}
                          </td>
                          <td style={tdStyle}>
                            {c.fraud_probability != null ? (
                              <span style={{ fontWeight: 600, color: c.fraud_probability >= 0.66 ? '#dc2626' : c.fraud_probability >= 0.33 ? '#d97706' : '#059669' }}>
                                {c.fraud_probability >= 0.66 ? 'High' : c.fraud_probability >= 0.33 ? 'Moderate' : 'Low'}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={tdStyle}>{c.loss_cause_primary || '-'}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              {c.completed_at ? new Date(c.completed_at).toLocaleDateString() : '-'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              onClick={() => toggleGameCase(c.claim_id, c.in_game)}
                              style={{
                                padding: '5px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                                color: c.in_game ? '#059669' : '#6b7280',
                                backgroundColor: c.in_game ? '#f0fdf4' : '#f9fafb',
                                border: c.in_game ? '1px solid #bbf7d0' : '1px solid #d1d5db',
                              }}
                            >
                              {c.in_game ? 'In Game' : 'Add to Game'}
                            </button>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              onClick={() => openGameDetail(c.claim_id, c.policy_id)}
                              style={{
                                padding: '5px 14px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                                color: ORANGE, backgroundColor: `${ORANGE}08`, border: `1px solid ${ORANGE}30`,
                              }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Game Case Detail Modal ── */}
          {gameDetailClaim && (
            <div onClick={() => setGameDetailClaim(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>Claim Details</h3>
                  <button onClick={() => setGameDetailClaim(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer' }}>✕</button>
                </div>

                {gameDetailLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>Loading claim details...</div>
                ) : !gameDetail ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>Could not load claim details.</div>
                ) : (() => {
                  const d = gameDetail
                  const p = gameDetailPolicy
                  const customer = p?.customer || {}
                  const vehicle = p?.vehicle || {}
                  const verdictColor = d.fraud_verdict === 'SIU' || d.fraud_verdict === 'REJECT' || d.fraud_verdict === 'DECLINE' ? '#dc2626' : d.fraud_verdict === 'AUTO APPROVE' || d.fraud_verdict === 'APPROVE' ? '#059669' : '#d97706'

                  const SectionTitle = ({ title }: { title: string }) => (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb' }}>{title}</div>
                  )
                  const DetailRow = ({ label, value }: { label: string; value: any }) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: '12px', color: '#1f2937', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value ?? '-'}</span>
                    </div>
                  )

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      {/* Claim Information */}
                      <div>
                        <SectionTitle title="Claim Information" />
                        <DetailRow label="Claim ID" value={d.claim_id} />
                        <DetailRow label="Policy ID" value={d.policy_id} />
                        <DetailRow label="Amount" value={d.claim_amount != null ? `$${Number(d.claim_amount).toLocaleString()}` : '-'} />
                        <DetailRow label="Verdict" value={d.fraud_verdict ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: verdictColor, backgroundColor: `${verdictColor}10` }}>{d.fraud_verdict}</span>
                        ) : '-'} />
                        <DetailRow label="Risk Level" value={d.fraud_probability != null ? (d.fraud_probability >= 0.66 ? 'High' : d.fraud_probability >= 0.33 ? 'Moderate' : 'Low') : '-'} />
                        <DetailRow label="Loss Cause" value={d.loss_cause_primary || d.loss_cause || '-'} />
                        <DetailRow label="Status" value={d.status} />
                        <DetailRow label="Created" value={d.created_at ? new Date(d.created_at).toLocaleString() : '-'} />
                      </div>

                      {/* Policy Information */}
                      <div>
                        <SectionTitle title="Policy Information" />
                        <DetailRow label="Type" value={p?.policy_type} />
                        <DetailRow label="Start Date" value={p?.policy_start_date} />
                        <DetailRow label="End Date" value={p?.policy_end_date} />
                        <DetailRow label="Premium" value={p?.policy_premium_amount != null ? `$${Number(p.policy_premium_amount).toLocaleString()}` : '-'} />
                        <DetailRow label="No-Claim Bonus" value={p?.no_claim_bonus_percent != null ? `${p.no_claim_bonus_percent}%` : '-'} />
                        <DetailRow label="Past Claims" value={p?.number_of_past_claims} />
                      </div>

                      {/* Customer */}
                      <div>
                        <SectionTitle title="Customer" />
                        <DetailRow label="Name" value={customer.name} />
                        <DetailRow label="Age" value={customer.age} />
                        <DetailRow label="Gender" value={customer.gender} />
                        <DetailRow label="Occupation" value={customer.occupation} />
                        <DetailRow label="Region" value={customer.region} />
                        <DetailRow label="Mobile" value={customer.mobile} />
                        <DetailRow label="Email" value={customer.email} />
                      </div>

                      {/* Vehicle */}
                      <div>
                        <SectionTitle title="Vehicle" />
                        <DetailRow label="Make" value={vehicle.make} />
                        <DetailRow label="Model" value={vehicle.model} />
                        <DetailRow label="Year" value={vehicle.year} />
                        <DetailRow label="VIN" value={vehicle.vin} />
                        <DetailRow label="Registration" value={vehicle.registration_number} />
                        <DetailRow label="Value" value={vehicle.value_estimate != null ? `$${Number(vehicle.value_estimate).toLocaleString()}` : '-'} />
                        <DetailRow label="Ownership" value={vehicle.ownership_type} />
                        <DetailRow label="Usage" value={vehicle.usage_type} />
                      </div>

                      {/* Incident Details */}
                      <div>
                        <SectionTitle title="Incident Details" />
                        <DetailRow label="Location" value={p?.accident_location_zip ? `ZIP ${p.accident_location_zip}` : '-'} />
                        <DetailRow label="Weather" value={p?.weather_condition} />
                        <DetailRow label="Police Report" value={p?.police_report_filed ? 'Yes' : 'No'} />
                        <DetailRow label="Witness Present" value={p?.witness_present ? 'Yes' : 'No'} />
                        <DetailRow label="Towed" value={p?.towed_from_scene ? 'Yes' : 'No'} />
                        <DetailRow label="Driver at Fault" value={p?.driver_at_fault ? 'Yes' : 'No'} />
                        <DetailRow label="Point of Impact" value={p?.initial_point_of_impact} />
                      </div>

                      {/* Claim Notes */}
                      <div>
                        <SectionTitle title="Claim Notes" />
                        <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.6, maxHeight: '200px', overflow: 'auto', padding: '8px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          {d.Claim_Notes || d.claim_summary || d.summary_text || 'No notes available.'}
                        </div>
                      </div>

                      {/* Attachments — inline previews */}
                      {(d.Claim_Image || d.Claim_PDF) && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <SectionTitle title="Attachments" />

                          {/* Image previews */}
                          {d.Claim_Image && (() => {
                            const urls = String(d.Claim_Image).split(',').map((u: string) => u.trim()).filter(Boolean)
                            return urls.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(urls.length, 3)}, 1fr)`, gap: '12px', marginBottom: d.Claim_PDF ? '16px' : 0 }}>
                                {urls.map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                                    <div style={{
                                      border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
                                      background: '#f9fafb', transition: 'box-shadow .2s',
                                    }}>
                                      <img
                                        src={url} alt={`Evidence ${i + 1}`}
                                        style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="height:180px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;">Image not available</div>' }}
                                      />
                                      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#6b7280', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>
                                        Evidence Image {i + 1}
                                      </div>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )
                          })()}

                          {/* PDF embeds */}
                          {d.Claim_PDF && (() => {
                            const urls = String(d.Claim_PDF).split(',').map((u: string) => u.trim()).filter(Boolean)
                            return urls.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {urls.map((url: string, i: number) => (
                                  <div key={`pdf-${i}`} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#374151', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span>PDF Document {i + 1}</span>
                                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: ORANGE, textDecoration: 'none', fontWeight: 600 }}>Open in new tab</a>
                                    </div>
                                    <iframe src={url} title={`PDF ${i + 1}`} style={{ width: '100%', height: '400px', border: 'none', display: 'block' }} />
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Fraud Detective Leaderboard Management ── */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Leaderboard</h3>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{gameLbEntries.length} entries</span>
            </div>
            {gameLbLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
            ) : gameLbEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>No leaderboard entries yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280' }}>#</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280' }}>Player</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Score</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Accuracy</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Cases</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Date</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'center', width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {gameLbEntries.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: i < 3 ? ORANGE : '#9ca3af' }}>#{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1f2937' }}>{e.player_name}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: ORANGE, textAlign: 'right', fontFamily: "'Oswald', sans-serif" }}>{e.score.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280', textAlign: 'right' }}>{Math.round(e.accuracy)}%</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280', textAlign: 'right' }}>{e.cases_played}</td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', textAlign: 'right', fontSize: '11px' }}>{e.played_at?.split('T')[0] || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button onClick={() => removeGameLbEntry(e.id)}
                          title="Remove entry"
                          style={{
                            padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                            color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '6px', cursor: 'pointer',
                          }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ IMAGE GAME TAB ═══ */}
      {dashTab === 'image_game' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Image Detective — Image Pool</h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
                Select images from claims and label them as Real, AI Edited, or AI Generated for the game. AI analysis results shown per image.
                {imgPoolCount > 0 && (
                  <span style={{ marginLeft: '8px', fontWeight: 700, color: ORANGE }}>{imgPoolCount} image{imgPoolCount !== 1 ? 's' : ''} in pool</span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={imgGameSearch} onChange={e => setImgGameSearch(e.target.value)}
                placeholder="Search by claim ID, label..."
                style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '8px', width: '220px', outline: 'none' }} />
              <button onClick={fetchImgGameEntries} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                Refresh
              </button>
              <button onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/quick-game`).then(() => {
                  setImgGameLinkCopied(true); setTimeout(() => setImgGameLinkCopied(false), 2000)
                })
              }} style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                color: imgGameLinkCopied ? '#16a34a' : '#fff',
                background: imgGameLinkCopied ? '#dcfce7' : ORANGE,
                border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}>
                {imgGameLinkCopied ? 'Link Copied!' : 'Copy Game Link'}
              </button>
            </div>
          </div>

          {imgGameLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading images...</div>
          ) : filteredImgGame.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              No claim images found. Submit and analyze some claims first.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {filteredImgGame.map((entry, i) => (
                <div key={`${entry.image_url}-${i}`} style={{
                  borderRadius: '12px', overflow: 'hidden',
                  border: entry.in_pool ? `2px solid ${ORANGE}` : '1px solid #e5e7eb',
                  background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ position: 'relative', height: '180px', background: '#f3f4f6' }}>
                    <img src={entry.image_url} alt="Claim evidence"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    {entry.in_pool && entry.label && (
                      <span style={{
                        position: 'absolute', top: '8px', right: '8px',
                        padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: entry.label === 'real' ? '#dcfce7' : entry.label === 'ai_edited' ? '#fef3c7' : '#fee2e2',
                        color: entry.label === 'real' ? '#166534' : entry.label === 'ai_edited' ? '#92400e' : '#991b1b',
                        border: `1px solid ${entry.label === 'real' ? '#86efac' : entry.label === 'ai_edited' ? '#fcd34d' : '#fca5a5'}`,
                      }}>
                        {entry.label === 'real' ? 'Real' : entry.label === 'ai_edited' ? 'AI Edited' : 'AI Generated'}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.claim_id || 'Unknown claim'}
                    </div>
                    {/* AI Analysis Result */}
                    {entry.ai_classification ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
                        padding: '5px 8px', borderRadius: '6px',
                        background: entry.ai_classification.toLowerCase().includes('real') ? '#f0fdf4'
                          : entry.ai_classification.toLowerCase().includes('edited') ? '#fffbeb' : '#fef2f2',
                        border: `1px solid ${entry.ai_classification.toLowerCase().includes('real') ? '#bbf7d0'
                          : entry.ai_classification.toLowerCase().includes('edited') ? '#fde68a' : '#fecaca'}`,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={
                          entry.ai_classification.toLowerCase().includes('real') ? '#16a34a'
                          : entry.ai_classification.toLowerCase().includes('edited') ? '#d97706' : '#dc2626'
                        } strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {entry.ai_classification.toLowerCase().includes('real') ? (
                            <path d="M20 6L9 17l-5-5" />
                          ) : (
                            <>
                              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                            </>
                          )}
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '11px', fontWeight: 700, lineHeight: 1.2,
                            color: entry.ai_classification.toLowerCase().includes('real') ? '#166534'
                              : entry.ai_classification.toLowerCase().includes('edited') ? '#92400e' : '#991b1b',
                          }}>
                            {entry.ai_classification}
                          </div>
                          {entry.ai_confidence_label && (
                            <div style={{ fontSize: '10px', color: '#6b7280', lineHeight: 1.2, marginTop: '1px' }}>
                              {entry.ai_confidence_label} confidence
                              {entry.ai_probability != null && ` · ${Math.round(entry.ai_probability * 100)}%`}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '10px', color: '#9ca3af', marginBottom: '8px',
                        padding: '4px 8px', borderRadius: '6px', background: '#f9fafb', border: '1px solid #f3f4f6',
                        fontStyle: 'italic',
                      }}>No AI analysis</div>
                    )}
                    {entry.in_pool ? (
                      <button onClick={() => entry.pool_id && removeImageFromPool(entry.pool_id)}
                        style={{
                          width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600,
                          color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                          borderRadius: '6px', cursor: 'pointer',
                        }}>
                        Remove from Pool
                      </button>
                    ) : (
                      <button onClick={() => { setImgLabelModal(entry); setImgSelectedLabel('real') }}
                        style={{
                          width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600,
                          color: ORANGE, background: `${ORANGE}08`, border: `1px solid ${ORANGE}40`,
                          borderRadius: '6px', cursor: 'pointer',
                        }}>
                        Add to Pool
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Leaderboard Management ── */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Leaderboard</h3>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{lbEntries.length} entries</span>
            </div>
            {lbLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>Loading...</div>
            ) : lbEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>No leaderboard entries yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280' }}>#</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280' }}>Player</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Score</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Accuracy</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>Played</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, color: '#6b7280', textAlign: 'center', width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lbEntries.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: i < 3 ? ORANGE : '#9ca3af' }}>#{i + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1f2937' }}>{e.player_name}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: ORANGE, textAlign: 'right', fontFamily: "'Oswald', sans-serif" }}>{e.score.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280', textAlign: 'right' }}>{Math.round(e.accuracy)}%</td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', textAlign: 'right', fontSize: '11px' }}>{e.played_at?.split('T')[0] || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button onClick={() => removeLbEntry(e.id)}
                          title="Remove entry"
                          style={{
                            padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                            color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '6px', cursor: 'pointer',
                          }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Label Assignment Modal */}
          {imgLabelModal && (
            <>
              <div onClick={() => setImgLabelModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
              <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: '420px', background: '#fff', borderRadius: '14px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)', zIndex: 201, overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Label this Image</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>How was this image created?</div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <img src={imgLabelModal.image_url} alt="Preview"
                    style={{ width: '100%', height: '200px', objectFit: 'contain', borderRadius: '10px', background: '#f3f4f6', marginBottom: '16px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { value: 'real', label: 'Real', desc: 'Original unmodified photograph', color: '#16a34a', bg: '#dcfce7' },
                      { value: 'ai_edited', label: 'AI Edited', desc: 'Real image modified with AI tools', color: '#d97706', bg: '#fef3c7' },
                      { value: 'ai_generated', label: 'AI Generated', desc: 'Entirely created by AI', color: '#dc2626', bg: '#fee2e2' },
                    ].map(opt => (
                      <label key={opt.value} onClick={() => setImgSelectedLabel(opt.value)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                          borderRadius: '8px', cursor: 'pointer',
                          border: imgSelectedLabel === opt.value ? `2px solid ${opt.color}` : '1px solid #e5e7eb',
                          background: imgSelectedLabel === opt.value ? opt.bg : '#fff',
                        }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '50%',
                          border: imgSelectedLabel === opt.value ? `5px solid ${opt.color}` : '2px solid #d1d5db',
                          flexShrink: 0,
                        }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{opt.label}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={() => setImgLabelModal(null)}
                    style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600, color: '#6b7280', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => {
                    addImageToPool(imgLabelModal.image_url, imgSelectedLabel, imgLabelModal.claim_id)
                    setImgLabelModal(null)
                  }}
                    style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700, color: '#fff', background: ORANGE, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    Add to Pool
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
