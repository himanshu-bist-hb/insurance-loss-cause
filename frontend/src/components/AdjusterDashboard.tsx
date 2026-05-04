/**
 * Adjuster Dashboard — Claims table with status badges and actions.
 */

import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'

interface ClaimReport {
  claim_id: string
  status: string
  created_at: string
  completed_at: string | null
  fraud_verdict?: string
  fraud_probability?: number
  loss_cause_primary?: string
  policy_id?: string
  claim_amount?: number
  claim_notes?: string
}

interface AdjusterDashboardProps {
  authToken: string
  onRunAnalysis: (claimId: string) => void
  onViewReport: (claimId: string) => void
  onViewProgress: (claimId: string) => void
}

export default function AdjusterDashboard({ authToken, onRunAnalysis, onViewReport, onViewProgress }: AdjusterDashboardProps) {
  const [claims, setClaims] = useState<ClaimReport[]>([])
  const [loading, setLoading] = useState(true)
  const [detailClaim, setDetailClaim] = useState<ClaimReport | null>(null)
  const [detailFull, setDetailFull] = useState<any>(null)
  const [detailPolicy, setDetailPolicy] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const openDetails = async (claim: ClaimReport) => {
    setDetailClaim(claim)
    setDetailFull(null)
    setDetailPolicy(null)
    setDetailLoading(true)

    // Fetch full claim data (untruncated notes + file paths)
    try {
      const res = await fetch(`${API_BASE_URL}/api/claims/${claim.claim_id}/detail`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setDetailFull(await res.json())
    } catch { /* ignore */ }

    // Fetch policy data
    if (claim.policy_id) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/policies/${claim.policy_id}`)
        if (res.ok) setDetailPolicy(await res.json())
      } catch { /* ignore */ }
    }

    setDetailLoading(false)
  }

  useEffect(() => {
    fetchClaims()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClaims = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/claims/all`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        setClaims(await res.json())
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      pending_analysis: { bg: '#fef3c7', color: '#92400e', label: 'Pending Analysis' },
      in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
      completed: { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
      error: { bg: '#fee2e2', color: '#991b1b', label: 'Error' },
    }
    const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
    return (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '12px',
        backgroundColor: s.bg,
        color: s.color,
      }}>
        {s.label}
      </span>
    )
  }

  const verdictBadge = (verdict?: string) => {
    if (!verdict) return <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
    const map: Record<string, { bg: string; color: string }> = {
      'AUTO APPROVE': { bg: '#d1fae5', color: '#065f46' },
      'MANUAL REVIEW': { bg: '#fef3c7', color: '#92400e' },
      'SIU': { bg: '#fee2e2', color: '#991b1b' },
      // Legacy values
      APPROVE: { bg: '#d1fae5', color: '#065f46' },
      FLAG: { bg: '#fef3c7', color: '#92400e' },
      REJECT: { bg: '#fee2e2', color: '#991b1b' },
    }
    const s = map[verdict] || { bg: '#f3f4f6', color: '#6b7280' }
    return (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: 700,
        borderRadius: '12px',
        backgroundColor: s.bg,
        color: s.color,
      }}>
        {verdict}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Claims Dashboard</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
            {claims.length} claim{claims.length !== 1 ? 's' : ''} submitted
          </p>
        </div>
        <button
          onClick={fetchClaims}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#6b7280',
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading claims...</div>
      ) : claims.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          color: '#9ca3af',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}>
          No claims submitted yet.
        </div>
      ) : (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={thStyle}>Claim ID</th>
                <th style={thStyle}>Policy</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Verdict</th>
                <th style={thStyle}>Fraud Prob.</th>
                <th style={thStyle}>Loss Cause</th>
                <th style={thStyle}>Submitted</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.claim_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: '#1f2937', fontFamily: 'monospace', fontSize: '12px' }}>
                      {c.claim_id}
                    </span>
                  </td>
                  <td style={tdStyle}>{c.policy_id || '-'}</td>
                  <td style={tdStyle}>
                    {c.claim_amount ? `$${Number(c.claim_amount).toLocaleString()}` : '-'}
                  </td>
                  <td style={tdStyle}>{statusBadge(c.status)}</td>
                  <td style={tdStyle}>{verdictBadge(c.fraud_verdict)}</td>
                  <td style={tdStyle}>
                    {c.fraud_probability != null ? (
                      <span style={{ fontWeight: 600, color: c.fraud_probability >= 0.66 ? '#dc2626' : c.fraud_probability >= 0.33 ? '#d97706' : '#059669' }}>
                        {c.fraud_probability >= 0.66 ? 'High' : c.fraud_probability >= 0.33 ? 'Moderate' : 'Low'}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '12px' }}>{c.loss_cause_primary || '-'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openDetails(c)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#4b5563',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        Details
                      </button>
                      {c.status === 'completed' && (
                        <>
                          <button
                            onClick={() => onViewReport(c.claim_id)}
                            style={{
                              padding: '5px 14px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: ORANGE,
                              backgroundColor: `${ORANGE}10`,
                              border: `1px solid ${ORANGE}30`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => onRunAnalysis(c.claim_id)}
                            title="Rerun analysis"
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#6b7280',
                              backgroundColor: '#f9fafb',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            ↻ Rerun
                          </button>
                        </>
                      )}
                      {c.status === 'pending_analysis' && (
                        <button
                          onClick={() => onRunAnalysis(c.claim_id)}
                          style={{
                            padding: '5px 14px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: ORANGE,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: `0 2px 8px ${ORANGE}40`,
                          }}
                        >
                          Run Analysis
                        </button>
                      )}
                      {c.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => onViewProgress(c.claim_id)}
                            style={{
                              padding: '5px 14px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#1e40af',
                              backgroundColor: '#dbeafe',
                              border: '1px solid #93c5fd',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              animation: 'pulse 2s infinite',
                            }}
                          >
                            ● View Progress
                          </button>
                          <button
                            onClick={() => onRunAnalysis(c.claim_id)}
                            title="Stop and rerun analysis"
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#6b7280',
                              backgroundColor: '#f9fafb',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            ↻ Rerun
                          </button>
                        </>
                      )}
                      {c.status === 'error' && (
                        <button
                          onClick={() => onRunAnalysis(c.claim_id)}
                          style={{
                            padding: '5px 14px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: ORANGE,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          ↻ Rerun
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'absolute', top: '16px', right: '20px',
              background: 'none', border: 'none', color: '#fff',
              fontSize: '28px', cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
          <img
            src={previewImage}
            alt="Evidence preview"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
              borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
        </div>
      )}

      {/* ── Claim Details Modal ── */}
      {detailClaim && (
        <div
          onClick={() => setDetailClaim(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', width: '640px', maxHeight: '85vh',
              overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '14px 14px 0 0',
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
                Claim Details — <span style={{ fontFamily: 'monospace' }}>{detailClaim.claim_id}</span>
              </h3>
              <button
                onClick={() => setDetailClaim(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', fontSize: '20px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Claim info section */}
              <SectionTitle label="Claim Information" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                <DetailRow label="Claim ID" value={detailClaim.claim_id} />
                <DetailRow label="Policy ID" value={detailClaim.policy_id || '—'} />
                <DetailRow label="Status" value={detailClaim.status} />
                <DetailRow label="Verdict" value={detailClaim.fraud_verdict || '—'} />
                <DetailRow label="Risk Level" value={detailClaim.fraud_probability != null ? (detailClaim.fraud_probability >= 0.66 ? 'High' : detailClaim.fraud_probability >= 0.33 ? 'Moderate' : 'Low') : '—'} />
                <DetailRow label="Loss Cause" value={detailClaim.loss_cause_primary || '—'} />
                <DetailRow label="Claim Amount" value={detailClaim.claim_amount ? `$${Number(detailClaim.claim_amount).toLocaleString()}` : '—'} />
                <DetailRow label="Submitted" value={detailClaim.created_at ? new Date(detailClaim.created_at).toLocaleString() : '—'} />
                {detailClaim.completed_at && (
                  <DetailRow label="Completed" value={new Date(detailClaim.completed_at).toLocaleString()} />
                )}
              </div>

              {/* Full claim notes (from /detail endpoint) */}
              {(detailFull?.Claim_Notes || detailClaim.claim_notes) && (
                <>
                  <SectionTitle label="Claim Notes (Original)" />
                  <p style={{
                    fontSize: '13px', color: '#4b5563', lineHeight: 1.7,
                    margin: 0, padding: '8px 0', whiteSpace: 'pre-wrap',
                  }}>
                    {detailFull?.Claim_Notes || detailClaim.claim_notes}
                  </p>
                </>
              )}

              {/* AI-generated claim summary */}
              {(detailFull?.claim_summary) && detailFull.claim_summary !== (detailFull?.Claim_Notes || '') && (
                <>
                  <SectionTitle label="Claim Summary (AI)" />
                  <p style={{
                    fontSize: '13px', color: '#4b5563', lineHeight: 1.7,
                    margin: 0, padding: '8px 0', whiteSpace: 'pre-wrap',
                    background: '#f9fafb', borderRadius: '6px', padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                  }}>
                    {detailFull.claim_summary}
                  </p>
                </>
              )}

              {/* Attached files / images */}
              {detailFull && (detailFull.Claim_Image || detailFull.Claim_PDF) && (
                <>
                  <SectionTitle label="Attachments" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '8px 0' }}>
                    {detailFull.Claim_Image && String(detailFull.Claim_Image).split(',').map((url: string, i: number) => {
                      const u = url.trim()
                      if (!u) return null
                      return (
                        <div
                          key={`img-${i}`}
                          onClick={() => setPreviewImage(u)}
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                        >
                          <img
                            src={u}
                            alt={`Evidence ${i + 1}`}
                            style={{
                              width: '140px', height: '105px', objectFit: 'cover',
                              borderRadius: '8px', border: '1px solid #e5e7eb',
                              transition: 'box-shadow 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #fa4e0a')}
                            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                          />
                        </div>
                      )
                    })}
                    {detailFull.Claim_PDF && String(detailFull.Claim_PDF).split(',').map((url: string, i: number) => {
                      const u = url.trim()
                      if (!u) return null
                      return (
                        <a
                          key={`pdf-${i}`}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 14px', borderRadius: '8px',
                            border: '1px solid #e5e7eb', background: '#f9fafb',
                            fontSize: '12px', fontWeight: 600, color: '#4b5563',
                            textDecoration: 'none',
                          }}
                        >
                          <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          PDF Document {i + 1}
                        </a>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Policy info section */}
              <SectionTitle label="Policy Information" />
              {detailLoading ? (
                <p style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 0' }}>Loading policy details...</p>
              ) : detailPolicy ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                    <DetailRow label="Policy ID" value={detailPolicy.policy_id} />
                    <DetailRow label="Type" value={detailPolicy.policy_type || '—'} />
                    <DetailRow label="LOB" value={detailPolicy.lob || 'Auto'} />
                    <DetailRow label="Status" value={detailPolicy.status || '—'} />
                    <DetailRow label="Start Date" value={detailPolicy.policy_start_date || '—'} />
                    <DetailRow label="End Date" value={detailPolicy.policy_end_date || '—'} />
                    <DetailRow label="Premium" value={detailPolicy.policy_premium_amount ? `$${Number(detailPolicy.policy_premium_amount).toLocaleString()}` : '—'} />
                    <DetailRow label="No-Claim Bonus" value={detailPolicy.no_claim_bonus_percent != null ? `${detailPolicy.no_claim_bonus_percent}%` : '—'} />
                    <DetailRow label="Past Claims" value={detailPolicy.number_of_past_claims ?? '—'} />
                  </div>

                  {/* Customer info */}
                  {detailPolicy.customer && (
                    <>
                      <SectionTitle label="Customer" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                        <DetailRow label="Name" value={detailPolicy.customer.name || '—'} />
                        <DetailRow label="Customer ID" value={detailPolicy.customer.id || '—'} />
                        <DetailRow label="Age" value={detailPolicy.customer.age || '—'} />
                        <DetailRow label="Gender" value={detailPolicy.customer.gender || '—'} />
                        <DetailRow label="Occupation" value={detailPolicy.customer.occupation || '—'} />
                        <DetailRow label="Region" value={detailPolicy.customer.region || '—'} />
                      </div>
                    </>
                  )}

                  {/* Vehicle info */}
                  {detailPolicy.vehicle && (
                    <>
                      <SectionTitle label="Vehicle" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                        <DetailRow label="Make" value={detailPolicy.vehicle.make || '—'} />
                        <DetailRow label="Model" value={detailPolicy.vehicle.model || '—'} />
                        <DetailRow label="Year" value={detailPolicy.vehicle.year || '—'} />
                        <DetailRow label="VIN" value={detailPolicy.vehicle.vin || '—'} />
                        <DetailRow label="Registration" value={detailPolicy.vehicle.registration_number || '—'} />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 0' }}>No policy data available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Modal helper components ── */

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      padding: '14px 0 6px', borderBottom: '1px solid #f3f4f6', marginBottom: '4px',
    }}>
      {label}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid #f9fafb',
      paddingRight: '16px',
    }}>
      <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>{value}</span>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
}
