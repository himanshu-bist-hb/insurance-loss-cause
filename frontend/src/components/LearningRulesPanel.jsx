import { useState, useEffect } from 'react'
import { Brain, RefreshCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { getLearningRules } from '../services/api'

export default function LearningRulesPanel() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const fetchRules = async () => {
    setLoading(true)
    try { const data = await getLearningRules(); setRules(data.rules || []) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { if (!collapsed) fetchRules() }, [collapsed])

  return (
    <div className="card overflow-hidden s6">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 p-5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <Brain size={16} className="text-violet-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Human Feedback Agent — Active Rules</p>
          <p className="text-xs text-slate-500 mt-0.5">Classification rules extracted from user feedback</p>
        </div>
        <div className="flex items-center gap-2">
          {rules.length > 0 && <span className="badge badge-primary">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>}
          {collapsed ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronUp size={15} className="text-slate-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-200 px-5 py-5">
          <div className="flex justify-end mb-4">
            <button onClick={fetchRules} disabled={loading} className="btn btn-secondary text-xs py-1.5 px-3">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && rules.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={20} className="text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-400">No learned rules yet</p>
              <p className="text-xs text-slate-400 mt-1">Submit feedback on results to train the system</p>
            </div>
          )}

          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={i} className="p-4 bg-violet-50 border border-violet-100 rounded-xl animate-fade-up">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-200 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{rule.extracted_rule}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="badge badge-primary text-[10px]">{rule.rule_category}</span>
                      {rule.applies_to && <span className="text-[10px] text-slate-400">{rule.applies_to}</span>}
                      <span className="text-[10px] text-slate-400 ml-auto">{new Date(rule.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
