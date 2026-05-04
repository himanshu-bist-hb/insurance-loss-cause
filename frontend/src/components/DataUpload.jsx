import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react'
import { uploadClaims } from '../services/api'
import toast from 'react-hot-toast'

export default function DataUpload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [file, setFile] = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0]
    if (!f) return
    setFile(f)
    setUploading(true)
    try {
      const data = await uploadClaims(f)
      setResult(data)
      if (data.success) {
        toast.success(`${data.row_count} claims loaded successfully`)
        onUploadComplete(data)
      } else {
        toast.error('Upload failed — check errors below')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
      setResult({ success: false, errors: [err.message] })
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const reset = () => { setFile(null); setResult(null) }

  return (
    <div className="card p-6 s2">
      <div className="flex items-center gap-3 mb-5">
        <div className="step-num">2</div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Upload Claims Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Required columns: <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded text-[11px]">claim_id</code>{' '}
            <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded text-[11px]">claim_notes</code>
          </p>
        </div>
        {result?.success && (
          <button onClick={reset} className="btn btn-secondary py-1.5 px-3 text-xs gap-1.5">
            <RefreshCw size={12} /> Re-upload
          </button>
        )}
      </div>

      {!result?.success ? (
        <div
          {...getRootProps()}
          className={`upload-zone ${isDragActive ? 'upload-zone-active' : ''} ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-600">Processing <span className="text-indigo-600">{file?.name}</span>…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Upload size={22} className={isDragActive ? 'text-indigo-500' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {isDragActive ? 'Drop it here' : 'Drop your file or'}{' '}
                  {!isDragActive && <span className="text-indigo-600 underline underline-offset-2">browse</span>}
                </p>
                <p className="text-xs text-slate-400 mt-1">CSV, XLSX, XLS — max 50 MB</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 truncate">{file?.name}</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {result.row_count} claims · {result.columns.length} columns
            </p>
          </div>
          <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
        </div>
      )}

      {result?.errors?.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
          {result.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {result?.success && result.preview?.length > 0 && (
        <div className="mt-5">
          <p className="label-sm mb-2">Preview — first {Math.min(result.preview.length, 10)} rows</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {result.columns.map(col => (
                    <th key={col} className="px-3 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap label-xs">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    {result.columns.map(col => (
                      <td key={col} className="px-3 py-2 text-slate-600 max-w-xs truncate font-mono">
                        {row[col] != null ? String(row[col]) : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
