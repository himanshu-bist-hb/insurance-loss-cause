/**
 * PolicyOwnerClaimForm — Two-step claim submission:
 *   Step 1: Upload evidence (images/PDF) + write incident description
 *   Step 2: LLM pre-fills the form fields, user fills the rest → submit
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { API_BASE_URL } from '../config'

const ORANGE = '#fa4e0a'
const today = new Date().toISOString().split('T')[0]

/** Convert markdown **bold** and *italic* to HTML, escape the rest */
function renderMd(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

interface PolicyOwnerClaimFormProps {
  policyData: any
  authToken: string
  onSubmit: (data: FormData) => void
  onBack: () => void
}

export default function PolicyOwnerClaimForm({ policyData, authToken, onSubmit, onBack }: PolicyOwnerClaimFormProps) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Server paths from Step 1 upload (reused in submit so files aren't re-uploaded)
  const [uploadedPaths, setUploadedPaths] = useState<{ images: string[], pdfs: string[] }>({ images: [], pdfs: [] })

  // AI-generated summaries from extract-fields
  const [imageSummary, setImageSummary] = useState('')
  const [pdfSummary, setPdfSummary] = useState('')

  // Step 2 state — form fields
  const [form, setForm] = useState({
    lob: policyData?.lob || 'Auto',
    claimDate: today,
    reportDate: today,
    amount: '',
    channel: '',
    impact: '',
    police: 'Yes',
    injury: '',
    numInjuries: '0',
    weather: '',
    zip: '',
    towed: 'No',
    notes: '',
    incidentHour: '',
    numVehicles: '2',
  })

  // Track which fields were pre-filled by LLM
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Image lightbox modal
  const [modalImage, setModalImage] = useState<{ src: string, name: string } | null>(null)

  // Memoize blob URLs so they persist across form re-renders (prevents iframe/image refresh)
  const fileUrls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => {
    return () => { fileUrls.forEach(url => URL.revokeObjectURL(url)) }
  }, [fileUrls])

  const [opts, setOpts] = useState<any>({
    channels: ['Web', 'Mobile', 'Agent'], weather: ['Clear', 'Rain', 'Snow', 'Fog'],
    impact: ['Front', 'Rear', 'Side-L', 'Side-R'], injury: ['None', 'Minor', 'Moderate', 'Severe']
  })

  const set = useCallback((k: string, v: string) => setForm(p => ({ ...p, [k]: v })), [])

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/options`).then(r => r.json()).then(d => {
      if (d.channels?.length) { setOpts((o: any) => ({ ...o, channels: d.channels })) }
      if (d.weather?.length) { setOpts((o: any) => ({ ...o, weather: d.weather })) }
      if (d.impact_points?.length) { setOpts((o: any) => ({ ...o, impact: d.impact_points })) }
      if (d.injury_types?.length) { setOpts((o: any) => ({ ...o, injury: d.injury_types })) }
    }).catch(() => { })
  }, [set])

  // ── Step 1 → Step 2: upload files + call LLM to extract fields ──
  const handleExtract = async () => {
    if (!description.trim() && files.length === 0) return
    setExtracting(true)

    try {
      // 1. Upload evidence files to the server (if any)
      let imagePaths: string[] = []
      let pdfPaths: string[] = []

      if (files.length > 0) {
        const uploadFd = new FormData()
        files.forEach(f => uploadFd.append('files', f))
        try {
          const uploadRes = await fetch(`${API_BASE_URL}/api/claims/upload-evidence`, {
            method: 'POST',
            body: uploadFd,
          })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            const paths: string[] = uploadData.paths || []
            // Split paths by file type
            files.forEach((f, i) => {
              if (i < paths.length) {
                if (f.type.startsWith('image')) imagePaths.push(paths[i])
                else if (f.type === 'application/pdf') pdfPaths.push(paths[i])
              }
            })
          }
          // Save server paths for use in submit (avoids re-uploading)
          if (imagePaths.length || pdfPaths.length) {
            setUploadedPaths({ images: imagePaths, pdfs: pdfPaths })
          }
        } catch {
          // Upload failed — continue with text-only extraction
        }
      }

      // 2. Call extract-fields with description + uploaded file paths
      const payload: Record<string, unknown> = { description: description.trim() }
      if (imagePaths.length > 0) payload.image_paths = imagePaths
      if (pdfPaths.length > 0) payload.pdf_paths = pdfPaths

      const res = await fetch(`${API_BASE_URL}/api/claims/extract-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const extracted = await res.json()
        if (!extracted.error) {
          // Capture AI summaries before applying form fields
          if (extracted._image_summary) setImageSummary(extracted._image_summary)
          if (extracted._pdf_summary) setPdfSummary(extracted._pdf_summary)

          const filled = new Set<string>()
          // Apply extracted fields to form (skip internal _ keys)
          Object.entries(extracted).forEach(([k, v]) => {
            if (k.startsWith('_')) return
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              set(k, String(v))
              filled.add(k)
            }
          })
          // Always keep the description as notes
          if (description.trim()) {
            set('notes', extracted.notes || description.trim())
            filled.add('notes')
          }
          setPrefilled(filled)
        }
      }
    } catch {
      // If extraction fails, proceed anyway — user fills manually
    }

    setExtracting(false)
    setStep(2)
  }

  // ── Step 2 → Submit ──
  const handleSubmit = () => {
    if (!policyData) return
    setSubmitting(true)

    const fd = new FormData()
    // Fields to skip from policyData (belong to previous claims, not this new one)
    const SKIP_POLICY_FIELDS = new Set([
      'Claim_Image', 'Claim_PDF', 'claim_id', 'claim_summary', 'Claim_Notes',
      'processing_status', 'created_at', 'updated_at',
      'loss_cause_primary', 'loss_cause_secondary', 'loss_cause_reasoning', 'loss_cause_output',
      'fraud_probability', 'fraud_verdict', 'ML Fraud Probability',
      'claim_date', 'claim_report_date', 'claim_amount',
    ])
    // Add policy data (skip stale claim-specific fields)
    Object.entries(policyData).forEach(([k, v]: [string, any]) => {
      if (SKIP_POLICY_FIELDS.has(k)) return
      if (typeof v === 'object' && v !== null) {
        Object.entries(v).forEach(([sk, sv]) =>
          fd.append(`${k === 'vehicle' ? 'vehicle_' : k === 'customer' ? 'customer_' : ''}${sk}`, String(sv))
        )
      } else { fd.append(k, String(v)) }
    })

    fd.append('customer_id', policyData.customer?.id || '')
    fd.append('claimant_name', policyData.customer?.name || '')

    // Only send fields that are visible in the form — hidden fields
    // (garage, broker, odometer, passengers, repair, fault, etc.) are
    // already present in policyData from the CSV and should not be overridden.
    const m: Record<string, string> = {
      'Date': form.claimDate, 'claim_report_date': form.reportDate, 'claim_amount': form.amount,
      'lob': form.lob, 'submission_channel': form.channel, 'initial_point_of_impact': form.impact,
      'bodily_injuries': form.numInjuries,
      'incident_hour_of_the_day': form.incidentHour,
      'number_of_vehicles_involved': form.numVehicles,
      'police_report_filed': form.police, 'injury_type': form.injury,
      'weather_condition': form.weather, 'accident_location_zip': form.zip,
      'towed_from_scene': form.towed,
      'Claim_Notes': description.trim() || form.notes,
      'claim_summary': form.notes,
    }
    Object.entries(m).forEach(([k, v]) => fd.append(k, v))

    // Include AI-generated summaries so downstream agents (loss cause etc.) can use them
    if (imageSummary) fd.append('Image_Summary', imageSummary)
    if (pdfSummary) fd.append('PDF_Summary', pdfSummary)

    // Attach image/PDF paths or files for this claim
    if (uploadedPaths.images.length) {
      // Server paths from Step 1 upload (already on server)
      fd.append('Claim_Image', uploadedPaths.images.join(','))
    } else {
      const imageFiles = files.filter(f => f.type.startsWith('image'))
      if (imageFiles.length > 0) {
        // Fallback: attach File objects for upload by App.tsx
        imageFiles.forEach(f => fd.append('Claim_Image', f))
      }
      // If no images at all, Claim_Image is simply absent — no stale data
    }
    if (uploadedPaths.pdfs.length) {
      fd.append('Claim_PDF', uploadedPaths.pdfs.join(','))
    } else {
      const pdfFiles = files.filter(f => f.type === 'application/pdf')
      if (pdfFiles.length > 0) {
        pdfFiles.forEach(f => fd.append('Claim_PDF', f))
      }
    }

    onSubmit(fd)
  }

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '36px', padding: '8px 12px', fontSize: '13px',
    color: '#1f2937', backgroundColor: '#ffffff', border: '1px solid #d1d5db',
    borderRadius: '6px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'auto' as const }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: '#4b5563',
    marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  }

  const renderInput = (label: string, k: string, type = 'text', prefix?: string) => {
    const isPrefilled = prefilled.has(k)
    return (
      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>
          {label}
          {isPrefilled && <span style={{ color: ORANGE, marginLeft: '6px', fontSize: '9px', fontWeight: 700 }}>AI-FILLED</span>}
        </label>
        <div style={{ position: 'relative' }}>
          {prefix && <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9ca3af' }}>{prefix}</span>}
          <input
            type={type}
            value={(form as any)[k]}
            onChange={e => set(k, e.target.value)}
            style={{
              ...inputStyle,
              height: '32px', padding: '6px 10px', fontSize: '12px',
              paddingLeft: prefix ? '22px' : '10px',
              borderColor: isPrefilled ? `${ORANGE}80` : '#d1d5db',
              backgroundColor: isPrefilled ? `${ORANGE}05` : '#ffffff',
            }}
          />
        </div>
      </div>
    )
  }

  const renderSelect = (label: string, k: string, options: string[]) => {
    const isPrefilled = prefilled.has(k)
    return (
      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>
          {label}
          {isPrefilled && <span style={{ color: ORANGE, marginLeft: '6px', fontSize: '9px', fontWeight: 700 }}>AI-FILLED</span>}
        </label>
        <select
          value={(form as any)[k]}
          onChange={e => set(k, e.target.value)}
          style={{
            ...selectStyle,
            height: '32px', padding: '4px 10px', fontSize: '12px',
            borderColor: isPrefilled ? `${ORANGE}80` : '#d1d5db',
            backgroundColor: isPrefilled ? `${ORANGE}05` : '#ffffff',
          }}
        >
          <option value="" disabled hidden>Select…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  const renderToggle = (label: string, k: string) => {
    const yes = (form as any)[k] === 'Yes'
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '32px', marginBottom: '6px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 500, color: !yes ? '#374151' : '#9ca3af' }}>No</span>
          <button type="button" onClick={() => set(k, yes ? 'No' : 'Yes')} style={{
            position: 'relative', width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            backgroundColor: yes ? ORANGE : '#d1d5db', transition: 'background-color 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: '2px', left: yes ? '18px' : '2px', width: '16px', height: '16px',
              borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '10px', fontWeight: 500, color: yes ? ORANGE : '#9ca3af' }}>Yes</span>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STEP 1: Upload Evidence + Describe Incident
  // ═══════════════════════════════════════════════
  if (step === 1) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px 24px' }}>
        {/* Back button */}
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', fontSize: '13px',
          fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '12px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to Policy
        </button>

        {/* Policy badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', backgroundColor: '#f9fafb', borderRadius: '8px',
          border: '1px solid #e5e7eb', marginBottom: '16px',
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Policy:</span>
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#1f2937' }}>{policyData?.policy_id}</span>
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>
          Submit a New Claim
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
          Describe the incident and upload any evidence. Our AI will pre-fill the claim form for you.
        </p>

        {/* Description */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Incident Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what happened — include details like date, location, weather, injuries, damage, etc."
            rows={4}
            style={{
              ...inputStyle, height: 'auto', resize: 'vertical', padding: '12px',
            }}
          />
        </div>

        {/* File upload */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Evidence (Images / PDF)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault(); setIsDragging(false)
              const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image') || f.type === 'application/pdf')
              if (dropped.length) setFiles(prev => [...prev, ...dropped])
            }}
            style={{
              border: `2px dashed ${isDragging ? ORANGE : '#d1d5db'}`,
              borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer',
              backgroundColor: isDragging ? '#fef3cd' : '#f9fafb', transition: 'all 0.2s',
            }}
          >
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} accept="image/*,.pdf"
              onChange={e => {
                const picked = Array.from(e.target.files || []).filter(f => f.type.startsWith('image') || f.type === 'application/pdf')
                if (picked.length) setFiles(prev => [...prev, ...picked])
                e.target.value = ''
              }}
            />
            {/* Hidden folder input */}
            <input ref={folderInputRef} type="file" multiple style={{ display: 'none' }} accept="image/*,.pdf"
              {...{ webkitdirectory: '', directory: '' } as any}
              onChange={e => {
                const picked = Array.from(e.target.files || []).filter(f => f.type.startsWith('image') || f.type === 'application/pdf')
                if (picked.length) setFiles(prev => [...prev, ...picked])
                e.target.value = ''
              }}
            />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ margin: '0 auto 6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>
              Drop files here or click to browse
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Supports images and PDF documents
            </div>
          </div>
          {/* Folder upload button */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); folderInputRef.current?.click() }}
            style={{
              marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', fontSize: '12px', fontWeight: 600,
              color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #d1d5db',
              borderRadius: '6px', cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            Upload Folder
          </button>

          {/* File previews */}
          {files.some(f => f.type.startsWith('image')) && (() => {
            const imageFiles = files.map((f, i) => ({ file: f, idx: i })).filter(({ file }) => file.type.startsWith('image'))
            return (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Images ({imageFiles.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: imageFiles.length === 1 ? '1fr' : imageFiles.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                  {imageFiles.map(({ file: f, idx }) => (
                    <div key={`img-${f.name}-${idx}`} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #e5e7eb', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = ORANGE)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                    >
                      <img src={fileUrls[idx]} alt={f.name}
                        style={{ width: '100%', height: imageFiles.length === 1 ? '200px' : '140px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                        onClick={() => window.open(fileUrls[idx], '_blank')}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== idx)) }}
                          style={{ background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: '4px', lineHeight: 1, marginLeft: '6px', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {files.some(f => f.type === 'application/pdf') && (() => {
            const pdfFiles = files.map((f, i) => ({ file: f, idx: i })).filter(({ file }) => file.type === 'application/pdf')
            return (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Documents ({pdfFiles.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pdfFiles.map(({ file: f, idx }) => (
                    <div key={`pdf-${f.name}-${idx}`} style={{ borderRadius: '10px', border: '1px solid #c7d2fe', overflow: 'hidden', backgroundColor: '#f8faff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #e0e7ff', background: '#eef2ff' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>
                          {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); window.open(fileUrls[idx], '_blank') }}
                          title="Open in new tab"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1, flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== idx)) }}
                          title="Remove"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1, flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                      <iframe
                        src={`${fileUrls[idx]}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                        title={f.name}
                        style={{ width: '100%', height: '280px', border: 'none', display: 'block', background: '#fff' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Continue button */}
        <button
          onClick={handleExtract}
          disabled={extracting || (!description.trim() && files.length === 0)}
          style={{
            padding: '12px 28px', fontSize: '14px', fontWeight: 700, color: '#fff',
            backgroundColor: extracting || (!description.trim() && files.length === 0) ? '#d1d5db' : ORANGE,
            border: 'none', borderRadius: '10px', cursor: extracting ? 'not-allowed' : 'pointer',
            boxShadow: extracting ? 'none' : `0 4px 16px ${ORANGE}40`,
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
          }}
        >
          {extracting ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51" />
              </svg>
              AI is analyzing your claim...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              Continue — Pre-fill with AI
            </>
          )}
        </button>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STEP 2: Pre-filled Form — User fills the rest
  // ═══════════════════════════════════════════════
  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#ffffff', borderRadius: '10px', padding: '14px 16px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }
  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '10px',
    paddingBottom: '8px', borderBottom: '1px solid #e5e7eb',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  }

  const emptyFields = Object.entries(form).filter(([k, v]) => !prefilled.has(k) && !v).map(([k]) => k)

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexShrink: 0 }}>
        <div>
          <button onClick={() => setStep(1)} style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', fontSize: '11px',
            fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '4px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to Evidence
          </button>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            Review & Complete Claim
          </h2>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
            Policy: <strong>{policyData?.policy_id}</strong>
            {prefilled.size > 0 && (
              <span style={{ marginLeft: '10px', color: ORANGE, fontWeight: 600 }}>
                {prefilled.size} fields pre-filled by AI
              </span>
            )}
          </p>
        </div>
        {/* Submit buttons in header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setStep(1)} style={{
            padding: '7px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280',
            backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer',
          }}>
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '7px 24px', fontSize: '12px', fontWeight: 700, color: '#fff',
              backgroundColor: submitting ? '#d1d5db' : ORANGE,
              border: 'none', borderRadius: '7px', cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: `0 2px 10px ${ORANGE}40`, display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </div>
      </div>

      {/* Form sections — fills remaining space */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* ── LEFT: All form fields (compact) ── */}
        <div style={{ ...sectionStyle, width: '380px', flexShrink: 0, overflow: 'auto' }}>
          <div style={sectionHeaderStyle}>Claim Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
            {renderInput('Date of Loss', 'claimDate', 'date')}
            {renderInput('Date Reported', 'reportDate', 'date')}
            {renderInput('Estimated Cost', 'amount', 'number', '$')}
            {renderInput('Location Zip', 'zip')}
            {renderSelect('Line of Business', 'lob', ['Auto', 'Home', 'Commercial'])}
            {renderSelect('Channel', 'channel', opts.channels)}
            {renderSelect('Incident Hour (0-23)', 'incidentHour', Array.from({ length: 24 }, (_, i) => String(i)))}
            {renderSelect('Impact Point', 'impact', opts.impact)}
            {renderSelect('Weather', 'weather', opts.weather)}
            {renderSelect('Injury Type', 'injury', opts.injury)}
            {renderInput('Vehicles Involved', 'numVehicles', 'number')}
            {renderInput('Bodily Injuries', 'numInjuries', 'number')}
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>{renderToggle('Vehicle Towed?', 'towed')}</div>
              <div style={{ flex: 1 }}>{renderToggle('Police Report?', 'police')}</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Single unified Evidence & AI panel ── */}
        <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

          {/* Panel header */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `linear-gradient(135deg, ${ORANGE}18, ${ORANGE}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Evidence & AI Analysis</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {files.length} file{files.length !== 1 ? 's' : ''} uploaded
                {(imageSummary || pdfSummary || form.notes) && ' \u00b7 AI analysis complete'}
              </div>
            </div>
          </div>

          {/* Scrollable content — two-column grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {(files.length > 0 || description.trim() || form.notes) ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>

                {/* ── COL 1: Images + Image AI ── */}
                <div>
                  {files.some(f => f.type.startsWith('image')) && (() => {
                    const imageFiles = files.map((f, i) => ({ file: f, idx: i })).filter(({ file }) => file.type.startsWith('image'))
                    return (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '10px' }}>
                          Uploaded Images ({imageFiles.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: imageFiles.length === 1 ? '1fr' : '1fr 1fr', gap: '8px' }}>
                          {imageFiles.map(({ file: f, idx }) => (
                            <div key={`img-${f.name}-${idx}`} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '2px solid #e5e7eb', cursor: 'pointer', transition: 'border-color 0.15s' }}
                              onClick={() => setModalImage({ src: fileUrls[idx], name: f.name })}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = ORANGE)}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                            >
                              <img src={fileUrls[idx]} alt={f.name}
                                style={{ width: '100%', height: imageFiles.length === 1 ? '200px' : '130px', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', flexShrink: 0, marginLeft: '6px' }}>
                                  {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {imageSummary && (
                          <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: '#f0f7ff', border: '1px solid #bfdbfe' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                              AI Image Analysis
                            </div>
                            <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: 1.6 }}
                              dangerouslySetInnerHTML={{ __html: renderMd(imageSummary) }} />
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* ── COL 2: Documents + PDF AI ── */}
                <div>
                  {files.some(f => f.type === 'application/pdf') && (() => {
                    const pdfFiles = files.map((f, i) => ({ file: f, idx: i })).filter(({ file }) => file.type === 'application/pdf')
                    return (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '10px' }}>
                          Uploaded Documents ({pdfFiles.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {pdfFiles.map(({ file: f, idx }) => (
                            <div key={`pdf-${f.name}-${idx}`} style={{ borderRadius: '10px', border: '1px solid #c7d2fe', overflow: 'hidden', backgroundColor: '#f8faff' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderBottom: '1px solid #e0e7ff', background: '#eef2ff' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                <span style={{ fontSize: '9px', color: '#9ca3af', flexShrink: 0 }}>
                                  {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`}
                                </span>
                                <button onClick={() => window.open(fileUrls[idx], '_blank')}
                                  title="Open in new tab"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1, flexShrink: 0 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                </button>
                              </div>
                              <iframe
                                src={`${fileUrls[idx]}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                                title={f.name}
                                style={{ width: '100%', height: '300px', border: 'none', display: 'block', background: '#fff' }}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                  {/* PDF AI analysis — always rendered outside the file check so it shows even standalone */}
                  {pdfSummary && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: '#faf5ff', border: '1px solid #ddd6fe' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        AI Document Analysis
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: renderMd(pdfSummary) }} />
                    </div>
                  )}
                </div>

                {/* ── COL 3: Claim Note + AI Summary ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Claim Note (original description) */}
                  {description.trim() && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        Claim Note
                      </div>
                      <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {description.trim()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Claim Summary */}
                  {form.notes && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        AI Claim Summary
                      </div>
                      <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #86efac' }}>
                        <div style={{ fontSize: '12.5px', color: '#14532d', lineHeight: 1.7 }}
                          dangerouslySetInnerHTML={{ __html: renderMd(form.notes) }} />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Empty state */
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>No evidence uploaded</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>AI summaries will appear after analysis</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image Lightbox Modal ── */}
      {modalImage && (
        <div
          onClick={() => setModalImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setModalImage(null)}
            style={{
              position: 'absolute', top: '16px', right: '16px', zIndex: 10000,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {/* Filename bar */}
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            padding: '6px 16px', borderRadius: '8px', background: 'rgba(0,0,0,0.6)',
            fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
          }}>
            {modalImage.name}
          </div>
          {/* Image */}
          <img
            src={modalImage.src}
            alt={modalImage.name}
            onClick={e => e.stopPropagation()}
            style={{
              minWidth: '60vw', minHeight: '55vh',
              maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain',
              borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </div>
  )
}
