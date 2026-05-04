import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

function JsonNode({ data, depth = 0, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(depth < 2 ? defaultExpanded : false)
  const [copied, setCopied] = useState(false)

  if (data === null || data === undefined) {
    return <span className="text-slate-400">null</span>
  }
  if (typeof data === 'boolean') {
    return <span className={data ? 'text-emerald-600' : 'text-red-500'}>{String(data)}</span>
  }
  if (typeof data === 'number') {
    return <span className="text-amber-600">{data}</span>
  }
  if (typeof data === 'string') {
    return <span className="text-slate-700">"{data}"</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-400">[]</span>
    return (
      <span>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center text-brand-600 hover:text-brand-700"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-slate-400 text-xs ml-0.5">[{data.length}]</span>
        </button>
        {expanded && (
          <div style={{ marginLeft: `${(depth + 1) * 12}px` }} className="mt-0.5 space-y-0.5">
            {data.map((item, i) => (
              <div key={i} className="flex items-start gap-1">
                <span className="text-slate-300 text-xs">·</span>
                <JsonNode data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    if (entries.length === 0) return <span className="text-slate-400">{'{}'}</span>
    return (
      <span>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center text-brand-600 hover:text-brand-700"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-slate-400 text-xs ml-0.5">{'{'}·{entries.length}{'}'}</span>
        </button>
        {expanded && (
          <div style={{ marginLeft: `${(depth + 1) * 12}px` }} className="mt-0.5 space-y-0.5">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-start gap-1">
                <span className="text-brand-700 font-medium text-xs shrink-0">{key}:</span>
                <JsonNode data={val} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  return <span>{String(data)}</span>
}

export default function JsonViewer({ data, title }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{title}</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <div className="p-4 font-mono text-xs leading-relaxed max-h-96 overflow-y-auto bg-white">
        <JsonNode data={data} />
      </div>
    </div>
  )
}
