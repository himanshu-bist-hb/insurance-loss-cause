import { useState } from 'react'
import { ChevronDown, ChevronUp, Edit3, Check, Copy, CheckCheck, Download, Table2, RotateCcw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { submitRemark, submitCorrection, runAnalysisPoll } from '../services/api'
import toast from 'react-hot-toast'

const AGENT_TABS = [
  { id: 'final',          label: 'Final Output',   emoji: '📋' },
  { id: 'classification', label: 'Classification', emoji: '🏷️' },
  { id: 'understanding',  label: 'Understanding',  emoji: '🔍' },
  { id: 'validation',     label: 'Validation',     emoji: '✅' },
]

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const fill = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="conf-bar-track flex-1">
        <div className="conf-bar-fill" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color: fill, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function JsonViewer({ data }) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(data, null, 2)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const renderValue = (val, depth = 0) => {
    if (val === null || val === undefined) return <span className="text-slate-400">null</span>
    if (typeof val === 'boolean') return <span className={val ? 'text-emerald-600' : 'text-red-500'}>{String(val)}</span>
    if (typeof val === 'number') return <span className="text-amber-600 font-semibold">{val}</span>
    if (typeof val === 'string') return <span className="text-slate-700">"{val}"</span>
    if (Array.isArray(val)) {
      if (!val.length) return <span className="text-slate-400">[]</span>
      return (
        <div>
          <span className="text-slate-400">[</span>
          <div style={{ marginLeft: (depth + 1) * 14 }}>
            {val.map((item, i) => (
              <div key={i}>{renderValue(item, depth + 1)}{i < val.length - 1 && <span className="text-slate-300">,</span>}</div>
            ))}
          </div>
          <span className="text-slate-400">]</span>
        </div>
      )
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val)
      if (!entries.length) return <span className="text-slate-400">{'{}'}</span>
      return (
        <div>
          <span className="text-slate-400">{'{'}</span>
          <div style={{ marginLeft: (depth + 1) * 14 }}>
            {entries.map(([k, v], i) => (
              <div key={k} className="flex gap-1 flex-wrap">
                <span className="text-indigo-600 font-semibold shrink-0">"{k}":</span>
                <span>{renderValue(v, depth + 1)}</span>
                {i < entries.length - 1 && <span className="text-slate-300">,</span>}
              </div>
            ))}
          </div>
          <span className="text-slate-400">{'}'}</span>
        </div>
      )
    }
    return <span>{String(val)}</span>
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="label-xs">JSON Output</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          {copied ? <><CheckCheck size={11} className="text-emerald-500" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <div className="p-4 json-viewer text-xs leading-relaxed max-h-72 overflow-y-auto bg-white">
        {renderValue(data)}
      </div>
    </div>
  )
}

function PdfRawBlock({ item }) {
  const [open, setOpen] = useState(false)
  const filename = item.path.split(/[/\\]/).pop()
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📄</span>
          <span className="text-xs font-semibold text-slate-700 truncate max-w-xs">{filename}</span>
          <span className="text-xs text-slate-400 font-normal hidden sm:inline">{item.path}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">{item.text ? `${item.text.length.toLocaleString()} chars` : 'empty'}</span>
          {open ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <pre className="p-4 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words bg-white max-h-64 overflow-y-auto font-mono">
          {item.text || '(no text extracted)'}
        </pre>
      )}
    </div>
  )
}

function PdfSection({ summary, extractions }) {
  return (
    <div className="mb-5">
      <p className="label-xs mb-3">PDF Documents</p>
      {summary && (
        <div className="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="label-xs text-amber-700 mb-1.5">AI Summary</p>
          <p className="text-xs text-amber-900 leading-relaxed">{summary}</p>
        </div>
      )}
      {extractions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium">Raw Extractions</p>
          {extractions.map((item, i) => (
            <PdfRawBlock key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClassificationTabContent({ original, corrected }) {
  const causeKeys = ['primary_cause', 'secondary_cause', 'tertiary_cause']
  const confKeys  = ['primary', 'secondary', 'tertiary']
  const causeLabels = { primary_cause: 'Primary', secondary_cause: 'Secondary', tertiary_cause: 'Tertiary' }
  const confLabels  = { primary: 'Primary Confidence', secondary: 'Secondary Confidence', tertiary: 'Tertiary Confidence' }

  const origConf = original?.confidence || {}
  const corrConf = corrected?.confidence || {}
  const fmtPct   = v => (v != null && v !== '') ? `${Math.round(Number(v) * 100)}%` : '—'
  const origOverall = fmtPct(origConf.overall)
  const corrOverall = fmtPct(corrConf.overall)
  const overallChanged = corrected && origConf.overall !== corrConf.overall

  return (
    <div>
      {corrected && (
        <div className="mb-3 rounded-xl overflow-hidden border border-slate-200">
          {/* Column headers */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 bg-slate-50 border-b border-slate-200">
            <div className="px-4 py-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Classification Agent</span>
            </div>
            <div className="px-4 py-2 bg-violet-50">
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Validation Correction</span>
            </div>
          </div>

          {/* Cause rows */}
          {causeKeys.map(key => {
            const changed = original[key] !== corrected[key]
            return (
              <div key={key} className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-100">
                <div className="px-4 py-2.5 bg-white">
                  <p className="text-xs text-slate-400 mb-0.5">{causeLabels[key]}</p>
                  <p className={`text-xs font-semibold ${changed ? 'text-red-500 line-through' : 'text-slate-700'}`}>
                    {original[key] || '—'}
                  </p>
                </div>
                <div className="px-4 py-2.5 bg-violet-50">
                  <p className="text-xs text-violet-400 mb-0.5">{causeLabels[key]}</p>
                  <p className={`text-xs font-semibold ${changed ? 'text-violet-700' : 'text-slate-400'}`}>
                    {corrected[key] || '—'}
                    {changed && <span className="ml-1.5 text-xs font-normal text-violet-400">← corrected</span>}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Confidence section sub-header */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
            <div className="px-4 py-1.5 bg-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence Scores</span>
            </div>
            <div className="px-4 py-1.5 bg-violet-100">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Confidence Scores</span>
            </div>
          </div>

          {/* Tier confidence rows */}
          {confKeys.map(key => {
            const ov = origConf[key]
            const cv = corrConf[key]
            const changed = ov !== cv
            return (
              <div key={key} className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-100">
                <div className="px-4 py-2.5 bg-white">
                  <p className="text-xs text-slate-400 mb-0.5">{confLabels[key]}</p>
                  <p className={`text-xs font-semibold ${changed ? 'text-red-500 line-through' : 'text-slate-700'}`}>
                    {fmtPct(ov)}
                  </p>
                </div>
                <div className="px-4 py-2.5 bg-violet-50">
                  <p className="text-xs text-violet-400 mb-0.5">{confLabels[key]}</p>
                  <p className={`text-xs font-semibold ${changed ? 'text-violet-700' : 'text-slate-400'}`}>
                    {fmtPct(cv)}
                    {changed && <span className="ml-1.5 text-xs font-normal text-violet-400">← updated</span>}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Overall confidence row */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-100">
            <div className="px-4 py-3 bg-slate-50">
              <p className="text-xs text-slate-400 mb-0.5">Overall Confidence</p>
              <p className={`text-sm font-bold ${overallChanged ? 'text-red-500 line-through' : 'text-slate-700'}`}>
                {origOverall}
              </p>
            </div>
            <div className="px-4 py-3 bg-violet-100">
              <p className="text-xs text-violet-400 mb-0.5">Overall Confidence</p>
              <p className={`text-sm font-bold ${overallChanged ? 'text-violet-700' : 'text-slate-500'}`}>
                {corrOverall}
                {overallChanged && <span className="ml-1.5 text-xs font-normal text-violet-400">← updated</span>}
              </p>
            </div>
          </div>

          {/* Correction reasoning */}
          {corrected.reasoning && (
            <div className="px-4 py-3 bg-violet-50 border-t border-violet-100">
              <p className="text-xs text-violet-500 font-semibold mb-1">Correction Reasoning</p>
              <p className="text-xs text-violet-800 leading-relaxed">{corrected.reasoning}</p>
            </div>
          )}
        </div>
      )}
      <JsonViewer data={original} />
    </div>
  )
}

function AgentOutputTabs({ result }) {
  const [active, setActive] = useState('final')
  const dataMap = {
    final: result.final_output,
    classification: result.classification_output,
    understanding: result.understanding_output,
    validation: result.validation_output,
  }
  const tabs = AGENT_TABS.filter(t => dataMap[t.id])

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all rounded-t-lg ${
              active === tab.id
                ? 'text-indigo-700 bg-white border border-b-white border-slate-200 -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.emoji}</span> {tab.label}
            {tab.id === 'classification' && result.corrected_classification_output && (
              <span className="ml-1 px-1.5 py-0.5 bg-violet-100 text-violet-600 text-xs rounded font-bold">Corrected</span>
            )}
          </button>
        ))}
      </div>
      {active === 'classification' && dataMap.classification
        ? <ClassificationTabContent original={dataMap.classification} corrected={result.corrected_classification_output || null} />
        : dataMap[active] && <JsonViewer data={dataMap[active]} />
      }
    </div>
  )
}

function FeedbackPanel({ claimId, claimNotes, classification, taxonomy }) {
  const [open, setOpen] = useState(false)
  const [primary, setPrimary]     = useState(classification?.primary_cause || '')
  const [secondary, setSecondary] = useState(classification?.secondary_cause || '')
  const [tertiary, setTertiary]   = useState(classification?.tertiary_cause || '')
  const [remark, setRemark]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Derive cascade options from the taxonomy object
  const primaryOptions   = taxonomy ? Object.keys(taxonomy) : []
  const secondaryOptions = primary && taxonomy?.[primary] ? Object.keys(taxonomy[primary]) : []
  const tertiaryOptions  = primary && secondary && taxonomy?.[primary]?.[secondary]
    ? taxonomy[primary][secondary]
    : []

  const handlePrimary = (val) => { setPrimary(val); setSecondary(''); setTertiary('') }
  const handleSecondary = (val) => { setSecondary(val); setTertiary('') }

  const handleSave = async () => {
    if (!primary) { toast.error('Select at least a primary cause'); return }
    setSubmitting(true)
    try {
      // Save the correction
      await submitCorrection({
        session_id: 'current',
        claim_id: claimId,
        claim_notes: claimNotes,
        original_classification: classification,
        corrected_classification: { primary_cause: primary, secondary_cause: secondary, tertiary_cause: tertiary },
      })
      // If there's a remark, also extract a learning rule from it
      if (remark.trim()) {
        await submitRemark({
          session_id: 'current',
          claim_id: claimId,
          claim_notes: claimNotes,
          classification: { primary_cause: primary, secondary_cause: secondary, tertiary_cause: tertiary },
          user_remark: remark,
        })
      }
      toast.success('Correction saved — feedback rule recorded')
      setOpen(false)
    } catch { toast.error('Failed to save correction') }
    finally { setSubmitting(false) }
  }

  const selectCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <p className="label-sm">Human Feedback Agent</p>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
            open
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <Edit3 size={11} />
          {open ? 'Cancel' : 'Correct Classification'}
        </button>
      </div>

      {open && (
        <div className="space-y-3 animate-fade-up bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">
            Select the correct classification from your taxonomy, then optionally add a remark to help the system learn.
          </p>

          {/* Primary */}
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Primary Cause</label>
            {taxonomy ? (
              <div className="relative">
                <select value={primary} onChange={e => handlePrimary(e.target.value)} className={selectCls}>
                  <option value="">— Select primary —</option>
                  {primaryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : (
              <input
                value={primary}
                onChange={e => { setPrimary(e.target.value); setSecondary(''); setTertiary('') }}
                placeholder="Primary cause"
                className="input text-xs py-2 w-full"
              />
            )}
          </div>

          {/* Secondary */}
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Secondary Cause</label>
            {taxonomy ? (
              <div className="relative">
                <select
                  value={secondary}
                  onChange={e => handleSecondary(e.target.value)}
                  disabled={!primary}
                  className={selectCls}
                >
                  <option value="">— Select secondary —</option>
                  {secondaryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : (
              <input
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                placeholder="Secondary cause"
                className="input text-xs py-2 w-full"
              />
            )}
          </div>

          {/* Tertiary */}
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Tertiary Cause</label>
            {taxonomy ? (
              <div className="relative">
                <select
                  value={tertiary}
                  onChange={e => setTertiary(e.target.value)}
                  disabled={!secondary}
                  className={selectCls}
                >
                  <option value="">— Select tertiary —</option>
                  {tertiaryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : (
              <input
                value={tertiary}
                onChange={e => setTertiary(e.target.value)}
                placeholder="Tertiary cause"
                className="input text-xs py-2 w-full"
              />
            )}
          </div>

          {/* Remark */}
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">
              Remark <span className="text-slate-400 font-normal">(optional — sent to the Human Feedback Agent)</span>
            </label>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="e.g. Short circuit cases should always map to Electrical Fault, not general Fire damage."
              rows={3}
              className="input text-xs resize-none w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className="btn btn-secondary text-xs py-1.5 px-3">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!primary || submitting} className="btn btn-primary text-xs py-1.5 px-3">
              {submitting
                ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                : <Check size={12} />
              }
              Save Correction
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultRow({ result, index, taxonomy, isRerunning, onRerun }) {
  const [expanded, setExpanded] = useState(false)
  const fc    = result.final_output?.final_classification
  const conf  = result.final_output?.confidence_score
  const grade = result.final_output?.classification_grade
  const gradeClass = grade === 'HIGH' ? 'badge-success' : grade === 'MEDIUM' ? 'badge-warning' : 'badge-error'
  const delay = `${index * 0.04}s`
  const isFailed = result.status === 'error'

  return (
    <div className={`border rounded-xl overflow-hidden bg-white card-hover ${isFailed ? 'border-red-200' : 'border-slate-200'}`} style={{ animation: `fadeUp 0.35s ${delay} ease both` }}>
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${result.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />

        <div className="font-mono text-xs font-bold text-slate-700 shrink-0 bg-slate-100 px-2 py-1 rounded-md">
          {result.claim_id}
        </div>

        {fc ? (
          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
            <span className="badge badge-primary shrink-0">{fc.primary_cause}</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-600 truncate hidden sm:block font-medium">{fc.secondary_cause}</span>
            <span className="text-slate-300 hidden sm:block">›</span>
            <span className="text-slate-400 truncate hidden lg:block">{fc.tertiary_cause}</span>
          </div>
        ) : (
          <span className="text-xs text-red-500 flex-1 truncate">{result.error || 'Classification failed'}</span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {conf !== undefined && (
            <div className="hidden sm:flex items-center gap-2 w-24">
              <ConfidenceBar value={conf} />
            </div>
          )}
          {grade && <span className={`badge ${gradeClass}`}>{grade}</span>}
          {/* Rerun button — shown for failed claims or always available */}
          {isFailed && onRerun && (
            <button
              onClick={e => { e.stopPropagation(); onRerun() }}
              disabled={isRerunning}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            >
              {isRerunning
                ? <><div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> Running…</>
                : <><RotateCcw size={11} /> Rerun</>
              }
            </button>
          )}
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-5 animate-fade-up">
          {/* Error banner with prominent Rerun */}
          {isFailed && (
            <div className="mb-5 flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-700 mb-1">Pipeline Failed</p>
                <p className="text-xs text-red-600 leading-relaxed break-words">{result.error || 'An error occurred during processing. Click Rerun to try again.'}</p>
              </div>
              {onRerun && (
                <button
                  onClick={onRerun}
                  disabled={isRerunning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed bg-white border-red-300 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                >
                  {isRerunning
                    ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Rerunning…</>
                    : <><RotateCcw size={14} /> Rerun Claim</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Classification 3-tier cards */}
          {fc && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Primary',   value: fc.primary_cause,   bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-400' },
                { label: 'Secondary', value: fc.secondary_cause, bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-400' },
                { label: 'Tertiary',  value: fc.tertiary_cause,  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   dot: 'bg-slate-400'  },
              ].map((f, i) => (
                <div key={f.label} className={`${f.bg} border ${f.border} rounded-xl p-3.5`} style={{ animation: `scaleIn 0.3s ${i * 0.07}s ease both` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                    <span className="label-xs">{f.label}</span>
                  </div>
                  <p className={`text-sm font-bold ${f.text} leading-tight`}>{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Confidence breakdown */}
          {result.final_output?.confidence_score !== undefined && (
            <div className="mb-5">
              {(() => {
                const effectiveConf = result.corrected_classification_output?.confidence
                  || result.classification_output?.confidence || {}
                const isCorrected = !!result.corrected_classification_output
                return (
                  <div className="space-y-2.5">
                    {isCorrected && (
                      <p className="text-xs text-violet-600 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                        Confidence scores from Validation Agent
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Overall',   val: result.final_output.confidence_score, reasoning: null },
                        { label: 'Primary',   val: effectiveConf.primary,   reasoning: effectiveConf.primary_reasoning },
                        { label: 'Secondary', val: effectiveConf.secondary, reasoning: effectiveConf.secondary_reasoning },
                        { label: 'Tertiary',  val: effectiveConf.tertiary,  reasoning: effectiveConf.tertiary_reasoning },
                      ].map(item => item.val !== undefined && (
                        <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                          <p className="label-xs mb-2">
                            {item.label} Confidence
                            {isCorrected && item.label !== 'Overall' && (
                              <span className="ml-1 text-violet-500 font-bold">·</span>
                            )}
                          </p>
                          <ConfidenceBar value={item.val} />
                          {item.reasoning && (
                            <p className="text-[10px] text-slate-500 leading-relaxed mt-2 italic border-t border-slate-200 pt-2">
                              {item.reasoning}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Reasoning */}
          {result.final_output?.reason && (
            <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="label-xs mb-2">AI Reasoning</p>
              <p className="text-xs text-slate-600 leading-relaxed">{result.final_output.reason}</p>
            </div>
          )}

          {/* Audit trail */}
          {result.final_output?.audit_trail && (
            <div className="mb-5">
              <p className="label-xs mb-2">Audit Trail</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(result.final_output.audit_trail).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-400 font-medium shrink-0 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-600 font-semibold">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Documents */}
          {result.understanding_output && (
            result.understanding_output.pdf_summary ||
            (result.understanding_output.pdf_raw_extractions && result.understanding_output.pdf_raw_extractions.length > 0)
          ) && (
            <PdfSection
              summary={result.understanding_output.pdf_summary}
              extractions={result.understanding_output.pdf_raw_extractions || []}
            />
          )}

          {/* Agent outputs */}
          <div className="mb-1">
            <p className="label-xs mb-3">Agent Outputs</p>
            <AgentOutputTabs result={result} />
          </div>

          <FeedbackPanel
            claimId={result.claim_id}
            claimNotes=""
            classification={result.final_output?.final_classification}
            taxonomy={taxonomy}
          />
        </div>
      )}
    </div>
  )
}

// ── Pure helpers (no hooks, safe inside render props) ─────────────────────────

function fmtPct(v) {
  if (v == null || v === '') return ''
  const n = Math.round(Number(v) * 100)
  return isNaN(n) ? '' : `${n}%`
}

function fmtArr(v) {
  if (!Array.isArray(v) || !v.length) return ''
  return v.map(i => (typeof i === 'string' ? i : i.issue || String(i))).join(' · ')
}

function trunc(text, max = 90) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

function confBar(raw) {
  if (raw == null || raw === '') return null
  const p = Math.round(Number(raw) * 100)
  if (isNaN(p)) return null
  const color = p >= 80 ? '#10B981' : p >= 60 ? '#F59E0B' : '#EF4444'
  return { p, color }
}

// ── Excel export ───────────────────────────────────────────────────────────────

function buildExcelRows(results) {
  return results.map(r => {
    const fc  = r.final_output?.final_classification || {}
    const cls = r.classification_output || {}
    const uo  = r.understanding_output  || {}
    const vo  = r.validation_output     || {}
    const fo  = r.final_output          || {}
    const valStatus = vo.is_valid === false ? 'Failed' : vo.is_valid === true ? 'Passed' : 'Skipped'
    const fix = vo.suggested_fix
    const corrected = r.completed_steps?.includes('classification_retry')
    return {
      'Claim ID':              r.claim_id,
      'Claim Notes':           r.claim_notes || '',
      'Incident Summary':      uo.incident_summary || '',
      'Key Signals':           fmtArr(uo.signals),
      'PDF Summary':           uo.pdf_summary || '',
      'Primary Cause':         fc.primary_cause   || cls.primary_cause   || '',
      'Primary Confidence':    fmtPct(cls.confidence?.primary),
      'Secondary Cause':       fc.secondary_cause || cls.secondary_cause || '',
      'Secondary Confidence':  fmtPct(cls.confidence?.secondary),
      'Tertiary Cause':        fc.tertiary_cause  || cls.tertiary_cause  || '',
      'Tertiary Confidence':   fmtPct(cls.confidence?.tertiary),
      'Overall Confidence':    fmtPct(fo.confidence_score ?? cls.confidence?.overall),
      'Grade':                 fo.classification_grade || '',
      'Validation':            valStatus,
      'Validation Score':      fmtPct(vo.validation_score),
      'Validation Issues':     fmtArr(vo.issues),
      'Validation Corrected':  corrected && fix ? `${fix.primary_cause} › ${fix.secondary_cause} › ${fix.tertiary_cause}` : '',
      'Correction Reasoning':  (corrected && fix?.correction_reasoning) || '',
      'AI Reasoning':          fo.reason || cls.reasoning || '',
    }
  })
}

function downloadExcel(results) {
  const rows = buildExcelRows(results)
  const ws   = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 60 }, { wch: 55 }, { wch: 45 }, { wch: 50 },
    { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 32 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 18 },
    { wch: 50 }, { wch: 40 }, { wch: 55 }, { wch: 60 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Classifications')
  XLSX.writeFile(wb, `loss-cause-classifications-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Summary table ──────────────────────────────────────────────────────────────
// All cell rendering is done with pure functions — no hooks inside render props.

const SUMMARY_GROUPS = [
  {
    label: 'Claim',
    cols: [
      {
        key: 'claim_id', head: 'Claim ID',
        render: r => (
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1E293B', background: '#F1F5F9', padding: '2px 7px', borderRadius: 5 }}>
            {r.claim_id}
          </span>
        ),
      },
      {
        key: 'status', head: 'Status',
        render: r => (
          <span className={`badge ${r.status === 'success' ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10 }}>
            {r.status === 'success' ? 'Success' : 'Error'}
          </span>
        ),
      },
      {
        key: 'notes', head: 'Claim Notes',
        render: r => r.claim_notes
          ? <span style={{ fontSize: 11, color: '#475569' }} title={r.claim_notes}>{trunc(r.claim_notes, 70)}</span>
          : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>,
      },
    ],
  },
  {
    label: 'Understanding Agent',
    cols: [
      {
        key: 'summary', head: 'Incident Summary',
        render: r => {
          const t = r.understanding_output?.incident_summary
          return t
            ? <span style={{ fontSize: 11, color: '#475569' }} title={t}>{trunc(t, 90)}</span>
            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
        },
      },
      {
        key: 'signals', head: 'Key Signals',
        render: r => {
          const s = r.understanding_output?.signals
          if (!Array.isArray(s) || !s.length) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          const preview = s.slice(0, 2).join(' · ') + (s.length > 2 ? ` +${s.length - 2}` : '')
          return <span style={{ fontSize: 11, color: '#475569' }} title={s.join(', ')}>{preview}</span>
        },
      },
      {
        key: 'pdf_summary', head: 'PDF Summary',
        render: r => {
          const t = r.understanding_output?.pdf_summary
          return t
            ? <span style={{ fontSize: 11, color: '#92400E' }} title={t}>{trunc(t, 80)}</span>
            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
        },
      },
    ],
  },
  {
    label: 'Classification Agent',
    cols: [
      {
        key: 'primary', head: 'Primary',
        render: r => {
          const v = r.final_output?.final_classification?.primary_cause || r.classification_output?.primary_cause
          return v
            ? <span className="badge badge-primary" style={{ fontSize: 10 }}>{v}</span>
            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
        },
      },
      {
        key: 'pri_conf', head: 'Primary Conf',
        render: r => {
          const ec = r.corrected_classification_output?.confidence || r.classification_output?.confidence || {}
          const b = confBar(ec.primary)
          if (!b) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
              <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.p}%`, background: b.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color, minWidth: 28 }}>{b.p}%</span>
            </div>
          )
        },
      },
      {
        key: 'secondary', head: 'Secondary',
        render: r => {
          const v = r.final_output?.final_classification?.secondary_cause || r.classification_output?.secondary_cause
          return <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{v || '—'}</span>
        },
      },
      {
        key: 'sec_conf', head: 'Secondary Conf',
        render: r => {
          const ec = r.corrected_classification_output?.confidence || r.classification_output?.confidence || {}
          const b = confBar(ec.secondary)
          if (!b) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
              <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.p}%`, background: b.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color, minWidth: 28 }}>{b.p}%</span>
            </div>
          )
        },
      },
      {
        key: 'tertiary', head: 'Tertiary',
        render: r => {
          const v = r.final_output?.final_classification?.tertiary_cause || r.classification_output?.tertiary_cause
          return <span style={{ fontSize: 11, color: '#64748B' }}>{v || '—'}</span>
        },
      },
      {
        key: 'ter_conf', head: 'Tertiary Conf',
        render: r => {
          const ec = r.corrected_classification_output?.confidence || r.classification_output?.confidence || {}
          const b = confBar(ec.tertiary)
          if (!b) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
              <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.p}%`, background: b.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color, minWidth: 28 }}>{b.p}%</span>
            </div>
          )
        },
      },
      {
        key: 'overall', head: 'Overall Conf',
        render: r => {
          const raw = r.final_output?.confidence_score ?? r.classification_output?.confidence?.overall
          const b = confBar(raw)
          if (!b) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
              <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.p}%`, background: b.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color, minWidth: 28 }}>{b.p}%</span>
            </div>
          )
        },
      },
      {
        key: 'grade', head: 'Grade',
        render: r => {
          const g = r.final_output?.classification_grade
          return g
            ? <span className={`badge ${g === 'HIGH' ? 'badge-success' : g === 'MEDIUM' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: 10 }}>{g}</span>
            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
        },
      },
    ],
  },
  {
    label: 'Validation Agent',
    cols: [
      {
        key: 'val', head: 'Validation',
        render: r => {
          if (!r.validation_output) return <span style={{ fontSize: 11, color: '#94A3B8' }}>Skipped</span>
          return r.validation_output.is_valid === false
            ? <span className="badge badge-error" style={{ fontSize: 10 }}>Failed</span>
            : <span className="badge badge-success" style={{ fontSize: 10 }}>Passed</span>
        },
      },
      {
        key: 'val_score', head: 'Val. Score',
        render: r => {
          const b = confBar(r.validation_output?.validation_score)
          if (!b) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
              <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.p}%`, background: b.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color, minWidth: 28 }}>{b.p}%</span>
            </div>
          )
        },
      },
      {
        key: 'val_issues', head: 'Issues',
        render: r => {
          const issues = r.validation_output?.issues
          if (!Array.isArray(issues) || !issues.length) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          const text = issues.map(i => (typeof i === 'string' ? i : i.issue || String(i))).join('; ')
          return <span style={{ fontSize: 11, color: '#475569' }} title={text}>{trunc(text, 70)}</span>
        },
      },
    ],
  },
  {
    label: 'Final',
    cols: [
      {
        key: 'reasoning', head: 'AI Reasoning',
        render: r => {
          const t = r.final_output?.reason || r.classification_output?.reasoning
          return t
            ? <span style={{ fontSize: 11, color: '#475569' }} title={t}>{trunc(t, 90)}</span>
            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
        },
      },
      {
        key: 'val_correction', head: 'Val. Correction',
        render: r => {
          const corrected = r.completed_steps?.includes('classification_retry')
          const fix = r.validation_output?.suggested_fix
          if (!corrected || !fix) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
          const label = `${fix.primary_cause} › ${fix.secondary_cause}`
          return (
            <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }} title={fix.correction_reasoning || ''}>
              {trunc(label, 50)}
            </span>
          )
        },
      },
    ],
  },
]

function SummaryTable({ results }) {
  const allCols = SUMMARY_GROUPS.flatMap(g => g.cols)

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%', tableLayout: 'auto' }}>
        <thead>
          <tr style={{ background: '#F1F5F9' }}>
            {SUMMARY_GROUPS.map(g => (
              <th
                key={g.label}
                colSpan={g.cols.length}
                style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6366F1', borderBottom: '1px solid #E2E8F0', borderRight: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr style={{ background: '#F8FAFC' }}>
            {allCols.map((c, i) => {
              const groupEnd = SUMMARY_GROUPS.reduce((acc, g) => {
                acc.push(acc[acc.length - 1] + g.cols.length)
                return acc
              }, [0]).slice(1)
              const isGroupEnd = groupEnd.includes(i + 1)
              return (
                <th
                  key={c.key}
                  style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94A3B8', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', borderRight: isGroupEnd ? '2px solid #E2E8F0' : '1px solid #F1F5F9' }}
                >
                  {c.head}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {results.map((r, ri) => (
            <tr
              key={r.claim_id}
              style={{ background: ri % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF' }}
              onMouseLeave={e => { e.currentTarget.style.background = ri % 2 === 0 ? 'white' : '#FAFBFC' }}
            >
              {allCols.map((c, i) => {
                const groupEnd = SUMMARY_GROUPS.reduce((acc, g) => {
                  acc.push(acc[acc.length - 1] + g.cols.length)
                  return acc
                }, [0]).slice(1)
                const isGroupEnd = groupEnd.includes(i + 1)
                return (
                  <td
                    key={c.key}
                    style={{ padding: '8px 12px', verticalAlign: 'top', maxWidth: 220, borderRight: isGroupEnd ? '2px solid #F1F5F9' : '1px solid #F8FAFC' }}
                  >
                    {c.render(r)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ResultsTable({ results, taxonomy, sessionId, onResultUpdate }) {
  const [showSummary, setShowSummary] = useState(false)
  const [rerunningIds, setRerunningIds] = useState(new Set())

  if (!results?.length) return null

  const succeeded = results.filter(r => r.status === 'success')
  const highConf  = succeeded.filter(r => (r.final_output?.confidence_score ?? 0) >= 0.80).length
  const lowConf   = succeeded.filter(r => (r.final_output?.confidence_score ?? 0) < 0.80).length
  const avgConf = succeeded.length
    ? (succeeded.reduce((a, r) => a + (r.final_output?.confidence_score || 0), 0) / succeeded.length)
    : 0

  const handleRerun = (claimId) => {
    if (!sessionId) { toast.error('Session ID not available'); return }
    setRerunningIds(prev => new Set([...prev, claimId]))

    runAnalysisPoll(
      { session_id: sessionId, taxonomy, lob: 'excess_and_surplus', run_validation: false, claim_ids: [claimId] },
      (event) => {
        if (event.type === 'claim_complete') {
          onResultUpdate?.(event)
          setRerunningIds(prev => { const next = new Set(prev); next.delete(claimId); return next })
        }
      },
      () => {
        setRerunningIds(prev => { const next = new Set(prev); next.delete(claimId); return next })
      },
      (err) => {
        toast.error('Rerun failed: ' + (err?.message || 'Unknown error'))
        setRerunningIds(prev => { const next = new Set(prev); next.delete(claimId); return next })
      }
    )
  }

  return (
    <div className="space-y-5">
      <div className="card p-6 s5">
        <div className="flex items-center gap-3 mb-6">
          <div className="step-num">5</div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Classification Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">{results.length} claims processed</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total',     value: results.length,          color: 'text-slate-700',    bg: 'bg-slate-50',   border: 'border-slate-200' },
            { label: 'Success',   value: succeeded.length,        color: 'text-emerald-600',  bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Low Conf',  value: lowConf,                 color: 'text-red-500',      bg: 'bg-red-50',     border: 'border-red-200' },
            { label: 'High Conf', value: highConf,                color: 'text-emerald-600',  bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Avg Score', value: `${Math.round(avgConf * 100)}%`, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-xl p-3.5 text-center`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="label-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {results.map((r, i) => (
            <ResultRow
              key={r.claim_id}
              result={r}
              index={i}
              taxonomy={taxonomy}
              isRerunning={rerunningIds.has(r.claim_id)}
              onRerun={sessionId ? () => handleRerun(r.claim_id) : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── Final Summary Table ──────────────────────────────────────────────── */}
      <div className="card overflow-hidden s6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Table2 size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Summary Table</p>
              <p className="text-xs text-slate-500 mt-0.5">All findings in a single tabular view</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSummary(s => !s)}
              className="btn btn-secondary text-xs py-1.5 px-3"
            >
              {showSummary ? 'Hide Table' : 'Show Table'}
            </button>
            <button
              onClick={() => downloadExcel(results)}
              className="btn btn-primary text-xs py-1.5 px-3"
            >
              <Download size={12} /> Download Excel
            </button>
          </div>
        </div>

        {showSummary && (
          <div className="p-5 animate-fade-up">
            <SummaryTable results={results} />
          </div>
        )}
      </div>
    </div>
  )
}
