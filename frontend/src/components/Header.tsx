/**
 * Header component with EXL branding + user info / logout
 */

import { useState } from 'react'
import exlLogo from '../assets/images/exl_logo.png'

interface HeaderProps {
  onLogoClick?: () => void
  userName?: string
  userRole?: string
  onLogout?: () => void
  onAgentMonitoring?: () => void
  showAgentMonitoringButton?: boolean
}

export default function Header({ onLogoClick, userName, userRole, onLogout, onAgentMonitoring, showAgentMonitoringButton }: HeaderProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  return (
    <header className="bg-white border-b border-[var(--border-light)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div
          className="flex items-center gap-4"
          onClick={onLogoClick}
          style={{ cursor: onLogoClick ? 'pointer' : 'default' }}
        >
          {/* EXL Logo */}
          <img
            src={exlLogo}
            alt="EXL"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Autonomous Claims Investigation & Fraud Intelligence
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Multi-Agent Analysis Platform
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showAgentMonitoringButton && onAgentMonitoring && (
            <button
              onClick={onAgentMonitoring}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #fa4e0a, #e0440a)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(250, 78, 10, 0.25)',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Agent Monitoring
            </button>
          )}
          {userName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#fa4e0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
              }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{userName}</div>
                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'capitalize' }}>{userRole}</div>
              </div>
            </div>
          )}
          {onLogout && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
          {!userName && (
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-[var(--border-light)]">
              <img src={exlLogo} alt="EXL" className="w-6 h-6 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', padding: '28px 32px',
              width: '380px', maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              textAlign: 'center',
            }}
          >
            {/* Icon */}
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: '#fef2f2', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>
              Confirm Logout
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to log out? Any unsaved progress will be lost.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600,
                  color: '#374151', background: '#f3f4f6', border: '1px solid #e5e7eb',
                  borderRadius: '8px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout?.() }}
                style={{
                  flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600,
                  color: '#fff', background: '#dc2626', border: 'none',
                  borderRadius: '8px', cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
