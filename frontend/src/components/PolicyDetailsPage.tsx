/**
 * POLICY DETAILS PAGE — Shows policy info, customer/vehicle details, and past claims
 */

import { useState, useEffect } from 'react'
import exlLogo from '../assets/images/exl_logo.png'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'
const F = 'ui-sans-serif, system-ui, -apple-system, sans-serif'

interface PastClaim {
  claim_id: string
  claim_date: string
  claim_amount: number
  fraud_verdict: string
  fraud_probability: number
  loss_cause: string
  processing_status: string
}

interface PolicyDetailsPageProps {
  policyId: string
  policyData: any
  onSubmitNewClaim: () => void
  onBack: () => void
  userRole?: string
}

const verdictColor = (v: string) => {
  const u = v?.toUpperCase() || ''
  if (u.includes('APPROVE')) return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
  if (u.includes('MANUAL REVIEW') || u.includes('FLAG') || u.includes('INVESTIGATE')) return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' }
  if (u.includes('SIU') || u.includes('REJECT') || u.includes('DENY')) return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
}

const riskColor = (p: number) => p > 70 ? '#dc2626' : p > 40 ? '#d97706' : '#16a34a'

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function PolicyDetailsPage({ policyId, policyData, onSubmitNewClaim, onBack, userRole }: PolicyDetailsPageProps) {
  const [claims, setClaims] = useState<PastClaim[]>([])
  const [loadingClaims, setLoadingClaims] = useState(true)

  const cust = policyData?.customer || {}
  const veh = policyData?.vehicle || {}

  useEffect(() => {
    setLoadingClaims(true)
    fetch(`${API_BASE_URL}/api/claims/by-policy/${policyId}`)
      .then(r => r.json())
      .then(data => { setClaims(Array.isArray(data) ? data : []); setLoadingClaims(false) })
      .catch(() => { setClaims([]); setLoadingClaims(false) })
  }, [policyId])

  /* Is policy active? */
  const isActive = (() => {
    try {
      return new Date(policyData?.policy_end_date) > new Date()
    } catch { return true }
  })()

  /* Reusable info row */
  const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#1f2937', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )

  /* Section card */
  const InfoCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div style={{
      background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: F }}>

      {/* ── Top Navigation Bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#6b7280',
          padding: '6px 12px', borderRadius: '8px', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#1f2937' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={exlLogo} alt="EXL" style={{ height: '20px', opacity: 0.6 }} />
        </div>

        <button onClick={onSubmitNewClaim} style={{
          padding: '8px 20px', background: ORANGE, color: '#fff', border: 'none',
          borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: `0 2px 8px ${ORANGE}40`,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${ORANGE}50` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 2px 8px ${ORANGE}40` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Submit New Claim
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>

        {/* ── Policy Header Card ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '16px', padding: '28px 32px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                {policyId}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                background: isActive ? '#16a34a20' : '#dc262620',
                color: isActive ? '#4ade80' : '#fca5a5',
                border: `1px solid ${isActive ? '#16a34a40' : '#dc262640'}`,
              }}>
                {isActive ? 'ACTIVE' : 'EXPIRED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                <strong style={{ color: '#cbd5e1' }}>Type:</strong> {policyData?.policy_type || '—'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                <strong style={{ color: '#cbd5e1' }}>Start:</strong> {policyData?.policy_start_date || '—'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                <strong style={{ color: '#cbd5e1' }}>End:</strong> {policyData?.policy_end_date || '—'}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                <strong style={{ color: '#cbd5e1' }}>LOB:</strong> {policyData?.lob || 'Auto'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Premium</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: ORANGE, lineHeight: 1 }}>
              {fmt(policyData?.policy_premium_amount || 0)}
            </div>
          </div>
        </div>

        {/* ── Three-Column Info Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>

          <InfoCard title="Customer Information" icon="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z">
            <InfoRow label="Name" value={cust.name} />
            <InfoRow label="Customer ID" value={cust.id} />
            <InfoRow label="Age" value={cust.age} />
            <InfoRow label="Gender" value={cust.gender} />
            <InfoRow label="Occupation" value={cust.occupation} />
            <InfoRow label="Region" value={cust.region} />
            <InfoRow label="Mobile" value={cust.mobile} />
            <InfoRow label="Email" value={cust.email} />
            <InfoRow label="Prior Fraud" value={cust.fraud_reported_before ? 'Yes' : 'No'} />
          </InfoCard>

          <InfoCard title="Vehicle Information" icon="M19 17h2l.64-2.54c.24-.959.24-1.962 0-2.92l-1.07-4.27A2 2 0 0018.63 6H5.37a2 2 0 00-1.94 1.27L2.36 11.54c-.24.958-.24 1.961 0 2.92L3 17h2m14 0a2 2 0 01-4 0m4 0a2 2 0 00-4 0m-8 0a2 2 0 01-4 0m4 0a2 2 0 00-4 0">
            <InfoRow label="Make" value={veh.make} />
            <InfoRow label="Model" value={veh.model} />
            <InfoRow label="Year" value={veh.year} />
            <InfoRow label="VIN" value={veh.vin} />
            <InfoRow label="Registration" value={veh.registration_number} />
            <InfoRow label="Ownership" value={veh.ownership_type} />
            <InfoRow label="Usage" value={veh.usage_type} />
            <InfoRow label="Est. Value" value={fmt(veh.value_estimate || 0)} />
          </InfoCard>

          <InfoCard title="Policy Details" icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
            <InfoRow label="Policy Type" value={policyData?.policy_type} />
            <InfoRow label="Line of Business" value={policyData?.lob || 'Auto'} />
            <InfoRow label="Premium" value={fmt(policyData?.policy_premium_amount || 0)} />
            <InfoRow label="Start Date" value={policyData?.policy_start_date} />
            <InfoRow label="End Date" value={policyData?.policy_end_date} />
            <InfoRow label="No-Claim Bonus" value={`${policyData?.no_claim_bonus_percent || 0}%`} />
            <InfoRow label="Past Claims" value={policyData?.number_of_past_claims || 0} />
            <InfoRow label="Status" value={isActive ? 'Active' : 'Expired'} />
          </InfoCard>
        </div>

        {/* ── Past Claims Table ── */}
        <div style={{
          background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#fafafa',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Claim History
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
              {claims.length} claim{claims.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingClaims ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Loading claim history...
            </div>
          ) : claims.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>No past claims found for this policy</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {['Claim ID', 'Date', 'Amount',
                      ...(userRole !== 'policyholder' ? ['Verdict', 'Fraud Probability'] : []),
                      'Loss Cause', 'Status',
                    ].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: '10px',
                        fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        letterSpacing: '0.5px', background: '#fafafa',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map(c => {
                    const vc = verdictColor(c.fraud_verdict)
                    const prob = Math.round((c.fraud_probability || 0) * 100)
                    return (
                      <tr key={c.claim_id} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <td style={{ padding: '10px 16px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#1f2937', fontSize: '12px' }}>
                          {c.claim_id}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{c.claim_date || '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1f2937' }}>
                          {c.claim_amount ? fmt(c.claim_amount) : '—'}
                        </td>
                        {userRole !== 'policyholder' && (
                          <td style={{ padding: '10px 16px' }}>
                            {c.fraud_verdict ? (
                              <span style={{
                                padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                                background: vc.bg, color: vc.color, border: `1px solid ${vc.border}`,
                                textTransform: 'uppercase',
                              }}>
                                {c.fraud_verdict}
                              </span>
                            ) : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        )}
                        {userRole !== 'policyholder' && (
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '48px', height: '6px', borderRadius: '3px', background: '#f3f4f6',
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${prob}%`, height: '100%', borderRadius: '3px',
                                  background: riskColor(prob),
                                }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: riskColor(prob) }}>
                                {prob}%
                              </span>
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: '12px' }}>
                          {c.loss_cause && c.loss_cause !== 'nan' ? c.loss_cause : '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {(() => {
                            const s = c.processing_status || 'pending'
                            const label =
                              s === 'completed' ? 'Processed' :
                              s === 'submitted' || s === 'pending_analysis' ? 'Yet to Process' :
                              s === 'in_progress' ? 'Processing' :
                              s === 'error' ? 'Error' : s
                            const bg =
                              s === 'completed' ? '#f0fdf4' :
                              s === 'error' ? '#fef2f2' :
                              s === 'in_progress' ? '#eff6ff' : '#fffbeb'
                            const color =
                              s === 'completed' ? '#16a34a' :
                              s === 'error' ? '#dc2626' :
                              s === 'in_progress' ? '#3b82f6' : '#d97706'
                            return (
                              <span style={{
                                padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                background: bg, color: color,
                              }}>
                                {label}
                              </span>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '40px' }}>
          <button onClick={onSubmitNewClaim} style={{
            padding: '14px 40px', background: ORANGE, color: '#fff', border: 'none',
            borderRadius: '10px', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            boxShadow: `0 4px 16px ${ORANGE}40`,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${ORANGE}50` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${ORANGE}40` }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Submit New Claim for This Policy
          </button>
        </div>
      </div>
    </div>
  )
}
