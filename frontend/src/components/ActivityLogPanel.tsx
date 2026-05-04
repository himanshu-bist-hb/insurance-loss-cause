/**
 * Activity Log Panel — slide-in drawer showing claim transactions
 * and loss cause taxonomy distribution.
 */
import { useMemo } from 'react'

export interface ClaimEntry {
  claim_id: string
  timestamp: string
  verdict: 'AUTO APPROVE' | 'MANUAL REVIEW' | 'SIU' | 'APPROVE' | 'FLAG' | 'REJECT'
  fraud_probability: number
  loss_cause_primary: string
  loss_cause_secondary?: string
  loss_cause_confidence?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  claims: ClaimEntry[]
}

const ORANGE = '#fa4e0a'

const verdictColor = (v: string) => v === 'AUTO APPROVE' || v === 'APPROVE' ? '#16a34a' : v === 'MANUAL REVIEW' || v === 'FLAG' ? '#d97706' : '#dc2626'
const verdictBg    = (v: string) => v === 'AUTO APPROVE' || v === 'APPROVE' ? '#f0fdf4' : v === 'MANUAL REVIEW' || v === 'FLAG' ? '#fffbeb' : '#fef2f2'
const riskColor    = (p: number) => p >= 66 ? '#dc2626' : p >= 33 ? '#d97706' : '#16a34a'

export default function ActivityLogPanel({ isOpen, onClose, claims }: Props) {
  const stats = useMemo(() => ({
    total:    claims.length,
    approved: claims.filter(c => c.verdict === 'AUTO APPROVE' || c.verdict === 'APPROVE').length,
    flagged:  claims.filter(c => c.verdict === 'MANUAL REVIEW' || c.verdict === 'FLAG').length,
    rejected: claims.filter(c => c.verdict === 'SIU' || c.verdict === 'REJECT').length,
  }), [claims])

  const taxonomyDist = useMemo(() => {
    const counts: Record<string, number> = {}
    claims.forEach(c => {
      if (c.loss_cause_primary) {
        counts[c.loss_cause_primary] = (counts[c.loss_cause_primary] || 0) + 1
      }
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [claims])

  const maxTax = taxonomyDist[0]?.[1] || 1

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40, backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '500px',
        background: '#fff', zIndex: 50,
        boxShadow: '-6px 0 30px rgba(0,0,0,0.13)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Activity Log</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Claim transactions &amp; loss cause taxonomy</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '15px' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>📋</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>No claims processed yet</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>Submit a claim to see activity here</div>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { label: 'Total',         value: stats.total,    color: '#3b82f6', bg: '#eff6ff' },
                  { label: 'Auto Approve', value: stats.approved, color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Manual Review', value: stats.flagged,  color: '#d97706', bg: '#fffbeb' },
                  { label: 'SIU',          value: stats.rejected, color: '#dc2626', bg: '#fef2f2' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}25`, borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Loss Cause Distribution */}
              {taxonomyDist.length > 0 && (
                <div style={{ background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: ORANGE, display: 'inline-block' }} />
                    Loss Cause Distribution
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {taxonomyDist.map(([cause, count], i) => (
                      <div key={cause}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>{cause}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>{count}</span>
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{Math.round((count / stats.total) * 100)}%</span>
                          </div>
                        </div>
                        <div style={{ height: '7px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(count / maxTax) * 100}%`,
                            background: i === 0
                              ? `linear-gradient(to right, ${ORANGE}, #fb923c)`
                              : i === 1
                              ? 'linear-gradient(to right, #f97316, #fbbf24)'
                              : '#d1d5db',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claim List */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#6b7280', display: 'inline-block' }} />
                  Recent Transactions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {[...claims].reverse().map((c, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Verdict pill */}
                      <div style={{ flexShrink: 0, padding: '3px 9px', borderRadius: '20px', background: verdictBg(c.verdict), border: `1px solid ${verdictColor(c.verdict)}30`, fontSize: '10px', fontWeight: 700, color: verdictColor(c.verdict), letterSpacing: '0.3px' }}>
                        {c.verdict}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.claim_id}</div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.loss_cause_primary}</div>
                      </div>
                      {/* Risk */}
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: riskColor(c.fraud_probability) }}>{c.fraud_probability >= 66 ? 'High' : c.fraud_probability >= 33 ? 'Moderate' : 'Low'}</div>
                        <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '1px' }}>{c.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
