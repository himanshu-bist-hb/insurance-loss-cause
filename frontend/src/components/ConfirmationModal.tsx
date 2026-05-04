/**
 * Confirmation Modal — Shown after claim submission
 */

const ORANGE = '#fa4e0a'

interface ConfirmationModalProps {
  claimId: string
  onClose: () => void
}

export default function ConfirmationModal({ claimId, onClose }: ConfirmationModalProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Success icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#d1fae5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>
          Claim Submitted
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
          Your claim has been received and is now under review.
        </p>

        {/* Claim ID */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Claim Reference
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>
            {claimId}
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#1e40af',
        }}>
          An adjuster will review your claim shortly. You can track the status from your dashboard.
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid #bbf7d0',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <span style={{ fontSize: '12px', color: '#15803d' }}>
            A confirmation email has been sent to your registered email address.
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '12px 32px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: ORANGE,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${ORANGE}40`,
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
