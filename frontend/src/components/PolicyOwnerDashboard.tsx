/**
 * Policy Owner Dashboard — Grid of user's policies
 */

import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'

interface Policy {
  policy_id: string
  lob?: string
  status?: string
  premium_amount?: number
  policy_premium_amount?: number
  policy_start_date?: string
  policy_end_date?: string
  customer?: { name?: string; id?: string }
  vehicle?: { make?: string; model?: string; year?: string }
  error?: string
}

interface PolicyOwnerDashboardProps {
  authToken: string
  userName: string
  onPolicyClick: (policyId: string, policyData: any) => void
}

export default function PolicyOwnerDashboard({ authToken, userName, onPolicyClick }: PolicyOwnerDashboardProps) {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/policies/my-policies`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (res.ok) {
          setPolicies(await res.json())
        }
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    fetchPolicies()
  }, [authToken])

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Welcome back, {userName}
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '6px 0 0' }}>
          Your policies are listed below. Click on a policy to view details or submit a claim.
        </p>
      </div>

      {/* Policy grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Loading your policies...</div>
      ) : policies.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          color: '#9ca3af',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}>
          No policies found for your account.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {policies.map(p => (
            <div
              key={p.policy_id}
              onClick={() => !p.error && onPolicyClick(p.policy_id, p)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                padding: '20px',
                cursor: p.error ? 'default' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => { if (!p.error) e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.boxShadow = `0 4px 12px ${ORANGE}15` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              {/* Policy ID header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>
                  {p.policy_id}
                </span>
                <span style={{
                  padding: '3px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  backgroundColor: p.status === 'Active' ? '#d1fae5' : '#fee2e2',
                  color: p.status === 'Active' ? '#065f46' : '#991b1b',
                  textTransform: 'uppercase',
                }}>
                  {p.status || 'Unknown'}
                </span>
              </div>

              {p.error ? (
                <div style={{ fontSize: '12px', color: '#ef4444' }}>Could not load policy details</div>
              ) : (
                <>
                  {/* LOB + Premium */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{p.lob || 'Auto'}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: ORANGE }}>
                      ${(p.premium_amount || p.policy_premium_amount || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Dates */}
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                    {p.policy_start_date} to {p.policy_end_date}
                  </div>

                  {/* Vehicle */}
                  {p.vehicle && (
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {p.vehicle.year} {p.vehicle.make} {p.vehicle.model}
                    </div>
                  )}

                  {/* Click hint */}
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: ORANGE,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    View Details
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
