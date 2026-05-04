import { ChevronDown } from 'lucide-react'

const LOBS = [
  { value: 'excess_and_surplus', label: 'Excess & Surplus (E&S)', desc: 'Non-standard commercial risks' },
  { value: 'auto', label: 'Auto', desc: 'Commercial and personal auto' },
]

export default function LOBSelector({ value, onChange }) {
  const selected = LOBS.find(l => l.value === value)

  return (
    <div className="card p-6 s1">
      <div className="flex items-center gap-3 mb-5">
        <div className="step-num">1</div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Line of Business</h2>
          <p className="text-xs text-slate-500 mt-0.5">Select the insurance line for this analysis batch</p>
        </div>
      </div>

      <div className="flex gap-3">
        {LOBS.map((lob) => (
          <button
            key={lob.value}
            onClick={() => onChange(lob.value)}
            className={`flex-1 text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${
              value === lob.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <p className={`text-sm font-semibold ${value === lob.value ? 'text-indigo-700' : 'text-slate-700'}`}>
              {lob.label}
            </p>
            <p className={`text-xs mt-0.5 ${value === lob.value ? 'text-indigo-500' : 'text-slate-400'}`}>
              {lob.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
