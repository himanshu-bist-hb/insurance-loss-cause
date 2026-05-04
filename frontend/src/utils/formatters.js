export function formatConfidence(val) {
  if (val === null || val === undefined) return '—'
  const pct = Math.round(val * 100)
  return `${pct}%`
}

export function confidenceColor(val) {
  if (!val && val !== 0) return 'text-slate-400'
  if (val >= 0.8) return 'text-emerald-600'
  if (val >= 0.6) return 'text-amber-600'
  return 'text-red-500'
}

export function gradeBadgeClass(grade) {
  switch (grade?.toUpperCase()) {
    case 'HIGH': return 'badge-green'
    case 'MEDIUM': return 'badge-yellow'
    case 'LOW': return 'badge-red'
    default: return 'badge-gray'
  }
}

export function lobLabel(lob) {
  const map = {
    auto: 'Auto',
    excess_and_surplus: 'Excess & Surplus',
  }
  return map[lob] || lob
}

export function stepLabel(step) {
  const map = {
    understanding: 'Understanding',
    classification: 'Classification',
    classification_retry: 'Classification (Retry)',
    validation: 'Validation',
    final_output: 'Final Output',
  }
  return map[step] || step
}
