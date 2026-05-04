/**
 * CLAIM FORM - Clean White Theme
 * 
 * Professional corporate design with:
 * - White/light gray color scheme
 * - Clear readable text
 * - EXL orange accents only
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

interface ClaimFormProps {
  onSubmit: (data: FormData) => void
  isProcessing: boolean
  initialPolicyData?: any
}

const today = new Date().toISOString().split('T')[0]

export default function ClaimForm({ onSubmit, isProcessing, initialPolicyData }: ClaimFormProps) {
  const [searchId, setSearchId] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [policyData, setPolicyData] = useState<any>(null)
  
  const [form, setForm] = useState({
    lob: 'Auto', claimDate: today, reportDate: today, amount: '5500',
    channel: '', impact: '', 
    witnessCount: '0', // Changed from Yes/No to Count
    police: 'Yes',
    injury: '', 
    numInjuries: '0', // New field
    weather: '', fault: 'No', zip: '90210',
    odo: '45000', paxIn: '1', paxOut: '0', repairEst: '4800',
    repairDays: '5', towed: 'No', garage: '', broker: '',
    licAge: '10', notes: '',
    incidentHour: '14', // New field (2pm default)
    numVehicles: '2'    // New field
  })
  
  const set = useCallback((k: string, v: string) => setForm(p => ({...p, [k]: v})), [])

  const [opts, setOpts] = useState<any>({
    garages: [], brokers: [],
    channels: ['Web', 'Mobile', 'Agent'], weather: ['Clear', 'Rain', 'Snow', 'Fog'],
    impact: ['Front', 'Rear', 'Side-L', 'Side-R'], injury: ['None', 'Minor', 'Moderate', 'Severe']
  })
  
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/options`).then(r => r.json()).then(d => {
      if(d.garages?.length) { setOpts((o: any) => ({...o, garages: d.garages})); set('garage', d.garages[0]) }
      if(d.brokers?.length) { setOpts((o: any) => ({...o, brokers: d.brokers})); set('broker', d.brokers[0]) }
      if(d.channels?.length) { setOpts((o: any) => ({...o, channels: d.channels})); set('channel', d.channels[0]) }
      if(d.weather?.length) { setOpts((o: any) => ({...o, weather: d.weather})); set('weather', d.weather[0]) }
      if(d.impact_points?.length) { setOpts((o: any) => ({...o, impact: d.impact_points})); set('impact', d.impact_points[0]) }
      if(d.injury_types?.length) { setOpts((o: any) => ({...o, injury: d.injury_types})); set('injury', d.injury_types[0]) }
    }).catch(() => {})
  }, [set])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchId.length >= 2 && !policyData) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/policies/search?q=${searchId}`)
          if (res.ok) { setSuggestions(await res.json()); setShowSuggestions(true) }
        } catch {}
      } else { setSuggestions([]); setShowSuggestions(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchId, policyData])

  useEffect(() => {
    const clickOut = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener("mousedown", clickOut)
    return () => document.removeEventListener("mousedown", clickOut)
  }, [])

  /* Auto-populate from policy details page */
  useEffect(() => {
    if (initialPolicyData && !policyData) {
      setSearchId(initialPolicyData.policy_id || '')
      setPolicyData(initialPolicyData)
      if(initialPolicyData.lob) set('lob', initialPolicyData.lob)
      if(initialPolicyData.incident_hour_of_the_day) set('incidentHour', String(initialPolicyData.incident_hour_of_the_day))
      if(initialPolicyData.number_of_vehicles_involved) set('numVehicles', String(initialPolicyData.number_of_vehicles_involved))
      if(initialPolicyData.bodily_injuries) set('numInjuries', String(initialPolicyData.bodily_injuries))
      if(initialPolicyData.witnesses) set('witnessCount', String(initialPolicyData.witnesses))
    }
  }, [initialPolicyData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (q: string) => {
    if (!q.trim()) return
    setPolicyData(null); setSuggestions([]); setShowSuggestions(false); setSearchId(q)
    try {
      const res = await fetch(`${API_BASE_URL}/api/policies/${q}`)
      if (res.ok) { 
        const data = await res.json(); 
        setPolicyData(data); 
        
        // Pre-fill form from policy data if available
        if(data.lob) set('lob', data.lob)
        if(data.incident_hour_of_the_day) set('incidentHour', String(data.incident_hour_of_the_day))
        if(data.number_of_vehicles_involved) set('numVehicles', String(data.number_of_vehicles_involved))
        if(data.bodily_injuries) set('numInjuries', String(data.bodily_injuries))
        if(data.witnesses) set('witnessCount', String(data.witnesses))
      }
    } catch {}
  }

  const handleSubmit = () => {
    if (!policyData) return
    const fd = new FormData()
    Object.entries(policyData).forEach(([k, v]: [string, any]) => {
      if (typeof v === 'object' && v !== null) {
        Object.entries(v).forEach(([sk, sv]) => fd.append(`${k === 'vehicle' ? 'vehicle_' : k === 'customer' ? 'customer_' : ''}${sk}`, String(sv)))
      } else { fd.append(k, String(v)) }
    })
    
    // Explicitly set calculated fields if missing in policy data
    fd.append('customer_id', policyData.customer.id)
    fd.append('claimant_name', policyData.customer.name)

    const m: Record<string, string> = {
      'Date': form.claimDate, 'claim_report_date': form.reportDate, 'claim_amount': form.amount,
      'lob': form.lob, 'submission_channel': form.channel, 'initial_point_of_impact': form.impact,
      
      // New mapped fields
      'witnesses': form.witnessCount,
      'witness_present': parseInt(form.witnessCount) > 0 ? 'Yes' : 'No', // Derived for model
      'bodily_injuries': form.numInjuries,
      'incident_hour_of_the_day': form.incidentHour,
      'number_of_vehicles_involved': form.numVehicles,

      'police_report_filed': form.police, 'injury_type': form.injury,
      'weather_condition': form.weather, 'driver_at_fault': form.fault, 'accident_location_zip': form.zip,
      'odometer_reading': form.odo, 'passengers_in_vehicle': form.paxIn, 'passengers_other_vehicle': form.paxOut,
      'repair_cost_estimate': form.repairEst, 'repair_duration_days': form.repairDays, 'towed_from_scene': form.towed,
      'garage_name': form.garage, 'broker_name': form.broker, 'driver_license_age_years': form.licAge,
      'Claim_Notes': form.notes
    }
    Object.entries(m).forEach(([k, v]) => fd.append(k, v))
    const img = files.find(f => f.type.startsWith('image'))
    const pdf = files.find(f => f.type === 'application/pdf')
    if (img) fd.append('Claim_Image', img)
    if (pdf) fd.append('Claim_PDF', pdf)
    onSubmit(fd)
  }

  const clearForm = () => {
    setSearchId('')
    setSuggestions([])
    setShowSuggestions(false)
    setPolicyData(null)
    setForm({
      lob: 'Auto', claimDate: today, reportDate: today, amount: '',
      channel: opts.channels?.[0] || '', impact: opts.impact?.[0] || '', 
      witnessCount: '0', police: 'Yes',
      injury: opts.injury?.[0] || '', numInjuries: '0',
      weather: opts.weather?.[0] || '', fault: 'No', zip: '',
      odo: '', paxIn: '1', paxOut: '0', repairEst: '',
      repairDays: '', towed: 'No', garage: opts.garages?.[0] || '', broker: opts.brokers?.[0] || '',
      licAge: '', notes: '', incidentHour: '', numVehicles: ''
    })
    setFiles([])
  }

  // Common inline styles to ensure visibility
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#1f2937',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit'
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'auto' as const
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#4b5563',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  }

  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  }

  const renderInput = (label: string, k: string, type = 'text', prefix?: string) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#9ca3af' }}>{prefix}</span>}
        <input 
          type={type} 
          value={(form as any)[k]} 
          onChange={e => set(k, e.target.value)} 
          style={{ ...inputStyle, paddingLeft: prefix ? '24px' : '12px' }}
          onFocus={e => e.target.style.borderColor = '#fa4e0a'}
          onBlur={e => e.target.style.borderColor = '#d1d5db'}
        />
      </div>
    </div>
  )

  const renderSelect = (label: string, k: string, options: string[]) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={labelStyle}>{label}</label>
      <select 
        value={(form as any)[k]} 
        onChange={e => set(k, e.target.value)} 
        style={selectStyle}
        onFocus={e => e.currentTarget.style.borderColor = '#fa4e0a'}
        onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
      >
        {options.map(o => <option key={o} value={o} style={{ color: '#1f2937' }}>{o}</option>)}
      </select>
    </div>
  )

  const renderToggle = (label: string, k: string) => {
    const yes = (form as any)[k] === 'Yes'
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '36px', marginBottom: '12px' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: !yes ? '#374151' : '#9ca3af' }}>No</span>
          <button 
            type="button" 
            onClick={() => set(k, yes ? 'No' : 'Yes')}
            style={{
              position: 'relative',
              width: '40px',
              height: '22px',
              borderRadius: '11px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: yes ? '#fa4e0a' : '#d1d5db',
              transition: 'background-color 0.2s'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: yes ? '20px' : '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              transition: 'left 0.2s'
            }} />
          </button>
          <span style={{ fontSize: '11px', fontWeight: 500, color: yes ? '#fa4e0a' : '#9ca3af' }}>Yes</span>
        </div>
      </div>
    )
  }

  const renderInfoRow = (l: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>{l}</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: '#1f2937' }}>{v || '-'}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#f3f4f6' }}>
      
      {/* MAIN FORM AREA */}
      <div style={{ width: '60%', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* TOP ROW: 2 Main Sections */}
        <div style={{ display: 'flex', gap: '16px' }}>
          
          {/* SECTION 1: INCIDENT & SCENE */}
          <div style={{ ...sectionStyle, flex: 1 }}>
            <div style={sectionHeaderStyle}>Incident & Scene Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {renderInput('Date of Loss', 'claimDate', 'date')}
              {renderInput('Date Reported', 'reportDate', 'date')}
              {renderInput('Loss Amount', 'amount', 'number', '$')}
              {renderInput('Location Zip', 'zip')}
              {renderSelect('Line of Business', 'lob', ['Auto', 'Home', 'Commercial'])}
              {renderSelect('Channel', 'channel', opts.channels)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', gridColumn: 'span 2' }}>
                  {renderSelect('Incident Hour (0-23)', 'incidentHour', Array.from({length: 24}, (_, i) => String(i)))}
                  {renderInput('Vehicles Involved', 'numVehicles', 'number')}
              </div>
              {renderSelect('Impact Point', 'impact', opts.impact)}
              {renderSelect('Weather', 'weather', opts.weather)}
              {renderInput('Odometer', 'odo')}
              {renderSelect('Injury Type', 'injury', opts.injury)}
              <div style={{ gridColumn: 'span 2' }}>
                {renderToggle('Vehicle Towed?', 'towed')}
              </div>
            </div>
          </div>

          {/* SECTION 2: PARTIES & REPAIR */}
          <div style={{ ...sectionStyle, flex: 1 }}>
            <div style={sectionHeaderStyle}>Parties & Repair</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {renderToggle('Driver at Fault?', 'fault')}
              {renderInput('Witnesses', 'witnessCount', 'number')}
              {renderInput('Bodily Injuries', 'numInjuries', 'number')}
              {renderToggle('Police Report?', 'police')}
              {renderInput('License Age (Yrs)', 'licAge', 'number')}
              {renderInput('Passengers (Own)', 'paxIn', 'number')}
              {renderInput('Passengers (Other)', 'paxOut', 'number')}
              {renderInput('Repair Estimate', 'repairEst', 'number', '$')}
              {renderInput('Est. Days', 'repairDays', 'number')}
              {renderSelect('Garage', 'garage', opts.garages)}
              {renderSelect('Broker', 'broker', opts.brokers)}
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Notes & Evidence */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Notes & Evidence</div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {/* Notes */}
            <div style={{ flex: 1 }}>
              <textarea 
                value={form.notes} 
                onChange={e => set('notes', e.target.value)} 
                placeholder="Describe the incident..."
                style={{
                  ...inputStyle,
                  height: '80px',
                  resize: 'none',
                  padding: '10px 12px'
                }}
                onFocus={e => e.target.style.borderColor = '#fa4e0a'}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Upload */}
            <div
              style={{
                minWidth: '160px',
                maxWidth: '240px',
                minHeight: '80px',
                border: `2px dashed ${isDragging ? '#fa4e0a' : '#d1d5db'}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                backgroundColor: isDragging ? '#fef3cd' : '#f9fafb',
                transition: 'all 0.2s',
                overflow: 'hidden'
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault(); setIsDragging(false)
                const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image') || f.type === 'application/pdf')
                if (dropped.length) setFiles(prev => [...prev, ...dropped])
              }}
            >
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} accept="image/*,.pdf"
                onChange={e => {
                  const picked = Array.from(e.target.files || []).filter(f => f.type.startsWith('image') || f.type === 'application/pdf')
                  if (picked.length) setFiles(prev => [...prev, ...picked])
                  e.target.value = ''
                }} />

              {/* Uploaded file list */}
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 8px' }}
                  onClick={e => e.stopPropagation()}>
                  {files.map((f, i) => {
                    const isImg = f.type.startsWith('image')
                    return (
                      <div key={`${f.name}-${i}`} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        background: isImg ? '#ecfdf5' : '#eff6ff',
                        borderRadius: '5px', padding: '3px 6px'
                      }}>
                        {isImg ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: 600,
                          color: isImg ? '#047857' : '#1d4ed8',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px'
                        }} title={f.name}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: '9px', color: '#6b7280', flexShrink: 0 }}>
                          {f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / (1024 * 1024)).toFixed(1)}MB`}
                        </span>
                        <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1, flexShrink: 0 }}
                          title={`Remove ${f.name}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Drop prompt */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: files.length > 0 ? '3px 0 5px' : '0',
                flex: files.length > 0 ? 'none' : 1,
                minHeight: files.length > 0 ? 'auto' : '80px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                <span style={{ fontSize: '10px', fontWeight: 500, marginTop: '2px', color: '#9ca3af' }}>
                  {files.length > 0 ? '+ Add more' : 'Drop Evidence'}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={handleSubmit} 
                disabled={isProcessing || !policyData}
                style={{
                  padding: '12px 32px',
                  height: '50px',
                  backgroundColor: isProcessing || !policyData ? '#d1d5db' : '#fa4e0a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isProcessing || !policyData ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isProcessing || !policyData ? 'none' : '0 4px 12px rgba(250,78,10,0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                {isProcessing ? 'Processing...' : 'Analyze'}
              </button>
              <button 
                onClick={clearForm} 
                disabled={isProcessing}
                style={{
                  padding: '8px 20px',
                  height: '30px',
                  backgroundColor: '#ffffff',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if(!isProcessing) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Light Theme Policy Panel */}
      {/* RIGHT SIDEBAR - Policy Info (45% width) */}
      <div style={{ 
        width: '40%', 
        backgroundColor: '#f8f9fa', 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column',
        borderLeft: '1px solid #e5e7eb'
      }}>
        
        {/* Search */}
        <div style={{ marginBottom: '16px', position: 'relative' }} ref={searchRef}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search Policy ID..." 
            value={searchId}
            onChange={e => { setSearchId(e.target.value); setPolicyData(null) }}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
            style={{
              width: '100%',
              padding: '10px 80px 10px 40px',
              fontSize: '14px',
              color: '#1f2937',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              outline: 'none'
            }}
          />
          <button 
            onClick={() => handleSearch(searchId)}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '6px 16px',
              backgroundColor: '#fa4e0a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            FETCH
          </button>
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              zIndex: 50
            }}>
              {suggestions.map(s => (
                <div 
                  key={s} 
                  onClick={() => handleSearch(s)} 
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    color: '#1f2937',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef3cd'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              backgroundColor: '#fa4e0a', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Policy Information</span>
          </div>
          <span style={{ fontSize: '10px', padding: '4px 8px', backgroundColor: '#e5e7eb', borderRadius: '4px', fontWeight: 600, color: '#6b7280' }}>READ ONLY</span>
        </div>

        {/* Content */}
        {!policyData ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              border: '2px dashed #d1d5db', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: '12px',
              color: '#9ca3af'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', margin: 0 }}>No Policy Selected</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Search above to load</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            
            {/* Policy Card */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', padding: '10px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fa4e0a', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Policy Details
              </div>
              {renderInfoRow('Policy ID', policyData.policy_id)}
              {renderInfoRow('Status', policyData.status)}
              {renderInfoRow('Line of Business', policyData.lob)}
              {renderInfoRow('Start Date', policyData.policy_start_date)}
              {renderInfoRow('End Date', policyData.policy_end_date)}
              {renderInfoRow('Premium Amount', `$${policyData.premium_amount || policyData.policy_premium_amount || '-'}`)}
            </div>

            {/* Customer Card */}
            {policyData.customer && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', padding: '10px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Customer
                </div>
                {renderInfoRow('Name', policyData.customer.name)}
                {renderInfoRow('Customer ID', policyData.customer.id)}
                {renderInfoRow('Phone', policyData.customer.phone || policyData.customer.mobile)}
                {renderInfoRow('Email', policyData.customer.email)}
              </div>
            )}

            {/* Vehicle Card */}
            {policyData.vehicle && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', padding: '10px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                  Vehicle
                </div>
                {renderInfoRow('Make', policyData.vehicle.make)}
                {renderInfoRow('Model', policyData.vehicle.model)}
                {renderInfoRow('Year', policyData.vehicle.year)}
                {renderInfoRow('VIN', policyData.vehicle.vin)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}