/**
 * Verdict card showing final fraud analysis result
 */

import exlLogo from '../assets/images/exl_logo.png'

interface Verdict {
  fraud_probability: number
  fraud_verdict: 'AUTO APPROVE' | 'MANUAL REVIEW' | 'SIU' | 'APPROVE' | 'FLAG' | 'REJECT'
  loss_cause_primary: string
  loss_cause_secondary?: string
  reasoning: string
  human_review_required: boolean
}

interface VerdictCardProps {
  verdict: Verdict | null
  isProcessing: boolean
}

// SVG Icons
const CheckCircleIcon = () => (
  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const WarningIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const AlertIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

export default function VerdictCard({ verdict, isProcessing }: VerdictCardProps) {
  if (!verdict && !isProcessing) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <img src={exlLogo} alt="EXL" className="h-5 w-auto opacity-60" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Verdict
          </h2>
        </div>
        <div className="text-center py-8 text-[var(--text-muted)]">
          <CheckCircleIcon />
          <p className="text-sm">Submit a claim to see the analysis verdict</p>
        </div>
      </div>
    )
  }
  
  if (isProcessing) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <img src={exlLogo} alt="EXL" className="h-5 w-auto opacity-60" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Verdict
          </h2>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 border-4 border-[var(--border-medium)] border-t-[var(--exl-orange)] rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">Analyzing claim...</p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Multi-agent analysis in progress
          </p>
        </div>
      </div>
    )
  }
  
  const verdictStyles: Record<string, string> = {
    'AUTO APPROVE': 'verdict-approve',
    'MANUAL REVIEW': 'verdict-flag',
    'SIU': 'verdict-reject',
    APPROVE: 'verdict-approve',
    FLAG: 'verdict-flag',
    REJECT: 'verdict-reject',
  }

  const verdictColors: Record<string, string> = {
    'AUTO APPROVE': 'text-green-600',
    'MANUAL REVIEW': 'text-amber-600',
    'SIU': 'text-red-600',
    APPROVE: 'text-green-600',
    FLAG: 'text-amber-600',
    REJECT: 'text-red-600',
  }

  const verdictIcons: Record<string, JSX.Element> = {
    'AUTO APPROVE': <CheckIcon />,
    'MANUAL REVIEW': <WarningIcon />,
    'SIU': <XIcon />,
    APPROVE: <CheckIcon />,
    FLAG: <WarningIcon />,
    REJECT: <XIcon />,
  }
  
  return (
    <div className={`card p-6 ${verdictStyles[verdict!.fraud_verdict]}`}>
      {/* Header with EXL branding */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={exlLogo} alt="EXL" className="h-5 w-auto opacity-60" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Verdict
          </h2>
        </div>
        <span className={`${verdictColors[verdict!.fraud_verdict]}`}>
          {verdictIcons[verdict!.fraud_verdict]}
        </span>
      </div>
      
      {/* Risk Level */}
      <div className="text-center mb-6 py-4 bg-[var(--bg-tertiary)] rounded-lg">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
          Risk Level
        </p>
        <p className={`text-2xl font-bold mt-1 ${verdictColors[verdict!.fraud_verdict]}`}>
          {verdict!.fraud_probability >= 0.66 ? 'HIGH' : verdict!.fraud_probability >= 0.33 ? 'MODERATE' : 'LOW'}
        </p>
        <p className={`text-lg font-semibold mt-2 ${verdictColors[verdict!.fraud_verdict]}`}>
          {verdict!.fraud_verdict}
        </p>
      </div>
      
      {/* Loss Cause */}
      <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-4">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
          Loss Cause Classification
        </p>
        <p className="font-medium text-[var(--text-primary)]">
          {verdict!.loss_cause_primary}
        </p>
        {verdict!.loss_cause_secondary && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            → {verdict!.loss_cause_secondary}
          </p>
        )}
      </div>
      
      {/* Human Review Warning */}
      {verdict!.human_review_required && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertIcon />
            <span>Human review recommended</span>
          </p>
        </div>
      )}
      
      {/* Reasoning */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
          Agent Reasoning
        </p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {verdict!.reasoning}
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-[var(--border-light)]">
        <button className="btn-secondary flex-1 text-sm">
          View Details
        </button>
        <button className="btn-primary flex-1 text-sm flex items-center justify-center gap-1">
          <img src={exlLogo} alt="" className="w-3 h-3 invert opacity-80" />
          Export
        </button>
      </div>
    </div>
  )
}
