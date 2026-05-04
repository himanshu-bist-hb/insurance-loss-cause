import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { TreePine, Upload, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { getDefaultTaxonomy, uploadTaxonomy } from '../services/api'
import toast from 'react-hot-toast'

function TaxonomyTree({ taxonomy }) {
  const [openPrimary, setOpenPrimary] = useState({})
  const [openSecondary, setOpenSecondary] = useState({})

  return (
    <div className="space-y-0.5">
      {Object.entries(taxonomy).map(([primary, secondaryDict]) => (
        <div key={primary} className="rounded-lg overflow-hidden">
          <button
            onClick={() => setOpenPrimary(p => ({ ...p, [primary]: !p[primary] }))}
            className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors rounded-lg group"
          >
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors">
              {openPrimary[primary] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            <span className="text-xs font-bold text-slate-700">{primary}</span>
            <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {Object.keys(secondaryDict).length}
            </span>
          </button>

          {openPrimary[primary] && (
            <div className="ml-5 border-l-2 border-slate-100 pl-3 mb-1 space-y-0.5">
              {Object.entries(secondaryDict).map(([secondary, tertiaryList]) => {
                const key = `${primary}::${secondary}`
                return (
                  <div key={secondary}>
                    <button
                      onClick={() => setOpenSecondary(p => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors rounded-lg group"
                    >
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-slate-400">
                        {openSecondary[key] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </div>
                      <span className="text-xs font-medium text-slate-600">{secondary}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{tertiaryList.length}</span>
                    </button>

                    {openSecondary[key] && (
                      <div className="ml-4 border-l-2 border-slate-100 pl-3 py-1 space-y-0.5">
                        {tertiaryList.map(t => (
                          <div key={t} className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-slate-50 transition-colors">
                            <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                            <span className="text-[11px] text-slate-500">{t}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function TaxonomySelector({ lob, onTaxonomyReady }) {
  const [loading, setLoading] = useState(false)
  const [taxonomy, setTaxonomy] = useState(null)
  const [source, setSource] = useState('default')
  const [error, setError] = useState(null)

  useEffect(() => { if (lob) loadDefault() }, [lob])

  async function loadDefault() {
    setLoading(true); setError(null)
    try {
      const data = await getDefaultTaxonomy(lob)
      setTaxonomy(data.taxonomy); setSource('default')
      onTaxonomyReady(data.taxonomy)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load taxonomy')
    } finally { setLoading(false) }
  }

  const onDrop = async (files) => {
    const f = files[0]; if (!f) return
    setLoading(true); setError(null)
    try {
      const data = await uploadTaxonomy(lob, f)
      setTaxonomy(data.taxonomy); setSource('custom')
      onTaxonomyReady(data.taxonomy)
      toast.success(`Custom taxonomy loaded — ${data.primary_count} primary categories`)
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid taxonomy file')
      toast.error('Invalid taxonomy file')
    } finally { setLoading(false) }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  const primaryCount = taxonomy ? Object.keys(taxonomy).length : 0
  const secondaryCount = taxonomy ? Object.values(taxonomy).reduce((a, s) => a + Object.keys(s).length, 0) : 0
  const tertiaryCount = taxonomy ? Object.values(taxonomy).reduce((a, s) => a + Object.values(s).reduce((b, t) => b + t.length, 0), 0) : 0

  return (
    <div className="card p-6 s3">
      <div className="flex items-center gap-3 mb-5">
        <div className="step-num">3</div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Taxonomy Configuration</h2>
          <p className="text-xs text-slate-500 mt-0.5">3-tier classification hierarchy — CSV, Excel, or JSON</p>
        </div>
        {taxonomy && !loading && (
          <div className="flex items-center gap-1.5">
            <span className={`badge ${source === 'custom' ? 'badge-primary' : 'badge-neutral'}`}>
              {source === 'custom' ? 'Custom' : 'Default'}
            </span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={loadDefault} disabled={loading} className="btn btn-secondary">
          <RotateCcw size={13} />
          Load Default
        </button>
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <button className={`btn btn-secondary ${isDragActive ? 'border-indigo-400 bg-indigo-50' : ''}`}>
            <Upload size={13} />
            Upload Taxonomy
            <span className="text-slate-400 font-normal text-[11px]">CSV / XLSX / JSON</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-4">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2.5 text-sm text-slate-500 py-6 justify-center">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading taxonomy…
        </div>
      )}

      {taxonomy && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Primary', value: primaryCount, color: 'text-indigo-600' },
              { label: 'Secondary', value: secondaryCount, color: 'text-purple-600' },
              { label: 'Tertiary', value: tertiaryCount, color: 'text-slate-600' },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="label-xs mt-0.5">{item.label} causes</p>
              </div>
            ))}
          </div>
          <div className="border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto bg-slate-50">
            <TaxonomyTree taxonomy={taxonomy} />
          </div>
        </>
      )}

      {!taxonomy && !loading && (
        <div className="flex flex-col items-center gap-2 text-slate-400 py-8">
          <TreePine size={24} />
          <p className="text-sm">No taxonomy loaded</p>
        </div>
      )}
    </div>
  )
}
