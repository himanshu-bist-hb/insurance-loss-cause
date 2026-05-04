/**
 * Claim Taxonomy Page — visual hierarchy explorer for the loss cause taxonomy.
 * Fetches from /api/taxonomy and renders a 3-level expandable tree.
 */
import { useState, useEffect } from 'react'
import type { ClaimEntry } from './ActivityLogPanel'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'

interface TaxonomyData {
  levels: number
  taxonomy: Record<string, Record<string, string[]> | string[]>
}

interface Props {
  claims: ClaimEntry[]
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#a3e635', '#84cc16',
]

const ChevronSvg = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export default function TaxonomyPage({ claims }: Props) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openPLC, setOpenPLC] = useState<Set<string>>(new Set())
  const [openSLC, setOpenSLC] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/taxonomy`)
      .then(r => r.json())
      .then((d: TaxonomyData) => { setTaxonomy(d); setLoading(false) })
      .catch(() => { setError('Failed to load taxonomy'); setLoading(false) })
  }, [])

  /* ── usage counts from session claims ───────────────────── */
  const usageCounts: Record<string, number> = {}
  claims.forEach(c => {
    if (c.loss_cause_primary) usageCounts[c.loss_cause_primary] = (usageCounts[c.loss_cause_primary] || 0) + 1
  })

  const togglePLC = (k: string) => setOpenPLC(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleSLC = (k: string) => setOpenSLC(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const matchSearch = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase())

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', margin: '0 auto 12px', borderRadius: '50%', border: `3px solid #e5e7eb`, borderTopColor: ORANGE, animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: '13px', color: '#6b7280' }}>Loading taxonomy...</div>
      </div>
    </div>
  )

  if (error || !taxonomy) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
      <div style={{ fontSize: '14px', color: '#6b7280' }}>{error || 'No taxonomy data'}</div>
    </div>
  )

  const plcKeys = Object.keys(taxonomy.taxonomy).filter(k => matchSearch(k))
  const totalCategories = Object.keys(taxonomy.taxonomy).length
  const totalSLC = Object.values(taxonomy.taxonomy).reduce((s, v) => {
    if (Array.isArray(v)) return s + v.length
    return s + Object.keys(v).length
  }, 0)
  const totalTLC = Object.values(taxonomy.taxonomy).reduce((s, v) => {
    if (Array.isArray(v)) return s
    return s + Object.values(v as Record<string, string[]>).reduce((ss, arr) => ss + (Array.isArray(arr) ? arr.length : 0), 0)
  }, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f3f4f6', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Page Header ── */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>Loss Cause Taxonomy</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
            {totalCategories} primary &nbsp;·&nbsp; {totalSLC} secondary {totalTLC > 0 ? `·  ${totalTLC} tertiary` : ''} &nbsp;·&nbsp; {taxonomy.levels}-level hierarchy
          </div>
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', gap: '6px', width: '220px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search taxonomy..."
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: '#374151', flex: 1 }}
          />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '14px', padding: 0, lineHeight: 1 }}>✕</button>}
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setOpenPLC(new Set(Object.keys(taxonomy.taxonomy)))}
            style={{ padding: '6px 12px', fontSize: '11px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>Expand All</button>
          <button onClick={() => { setOpenPLC(new Set()); setOpenSLC(new Set()) }}
            style={{ padding: '6px 12px', fontSize: '11px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>Collapse All</button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '10px', flexShrink: 0 }}>
        {[
          { label: 'Primary Categories', value: totalCategories, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Secondary Categories', value: totalSLC, color: '#8b5cf6', bg: '#f5f3ff' },
          ...(totalTLC > 0 ? [{ label: 'Tertiary Categories', value: totalTLC, color: '#ec4899', bg: '#fdf2f8' }] : []),
          { label: 'Session Uses', value: claims.length, color: ORANGE, bg: '#fff7ed' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Tree ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {plcKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '13px' }}>No results for "{search}"</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plcKeys.map((plc, idx) => {
              const val = taxonomy.taxonomy[plc]
              const isOpen = openPLC.has(plc)
              const color = PALETTE[idx % PALETTE.length]
              const uses = usageCounts[plc] || 0
              const isList = Array.isArray(val)
              const slcKeys = isList ? (val as string[]) : Object.keys(val as Record<string, string[]>)

              return (
                <div key={plc} style={{ background: '#fff', border: `1px solid ${isOpen ? color + '40' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  {/* PLC Header */}
                  <button
                    onClick={() => togglePLC(plc)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: isOpen ? color + '08' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ width: '28px', height: '28px', borderRadius: '7px', background: color + '20', border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ChevronSvg open={isOpen} />
                    </span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flex: 1 }}>{plc}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {uses > 0 && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#fff7ed', border: `1px solid ${ORANGE}30`, fontSize: '10px', fontWeight: 700, color: ORANGE }}>
                          {uses} use{uses !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: '12px', background: color + '15', border: `1px solid ${color}30`, fontSize: '10px', fontWeight: 600, color }}>
                        {slcKeys.length} {taxonomy.levels > 1 ? 'sub' : 'item'}{slcKeys.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>

                  {/* SLC Children */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${color}20`, padding: '8px 16px 12px' }}>
                      {isList ? (
                        /* 2-level: list of SLC strings */
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '38px' }}>
                          {(val as string[]).map(slc => (
                            <span key={slc} style={{ padding: '4px 10px', borderRadius: '20px', background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                              {slc}
                            </span>
                          ))}
                        </div>
                      ) : (
                        /* 3-level: SLC → TLC */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '22px' }}>
                          {Object.entries(val as Record<string, string[]>).map(([slc, tlcs]) => {
                            const slcKey = `${plc}::${slc}`
                            const slcOpen = openSLC.has(slcKey)
                            const hasTLC = Array.isArray(tlcs) && tlcs.length > 0

                            return (
                              <div key={slc} style={{ borderRadius: '7px', overflow: 'hidden' }}>
                                <button
                                  onClick={() => hasTLC && toggleSLC(slcKey)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: slcOpen ? color + '06' : 'transparent', border: 'none', cursor: hasTLC ? 'pointer' : 'default', textAlign: 'left', borderRadius: '6px' }}
                                >
                                  {hasTLC
                                    ? <span style={{ color: color + 'aa' }}><ChevronSvg open={slcOpen} /></span>
                                    : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: `1.5px solid ${color}50`, display: 'inline-block', flexShrink: 0 }} />
                                  }
                                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151', flex: 1 }}>{slc}</span>
                                  {hasTLC && (
                                    <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>{tlcs.length} TLC</span>
                                  )}
                                </button>

                                {/* TLC chips */}
                                {slcOpen && hasTLC && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '4px 10px 8px 30px' }}>
                                    {tlcs.map(tlc => (
                                      <span key={tlc} style={{ padding: '3px 9px', borderRadius: '20px', background: color + '10', border: `1px solid ${color}25`, fontSize: '11px', color: color, fontWeight: 500 }}>
                                        {tlc}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
