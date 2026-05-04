import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../config'

interface ModelFeatures {
  num_cols: string[]
  text_cols: string[]
  options: Record<string, string[]>
  defaults: Record<string, number | string>
}

interface PredictionResult {
  fraud_probability: number
  fraud_prediction: number
  risk_level: string
  confidence: number
  feature_importance: Record<string, number>
  reasoning: string
}

// Friendly labels for feature names
const LABELS: Record<string, string> = {
  policy_duration_days: 'Policy Duration (days)',
  days_to_policy_expiry_at_claim: 'Days to Policy Expiry',
  policy_tenure_years: 'Policy Tenure (years)',
  policy_premium_amount: 'Premium Amount',
  no_claim_bonus_percent: 'No-Claim Bonus %',
  number_of_past_claims: 'Past Claims',
  customer_age: 'Customer Age',
  days_to_report_claim: 'Days to Report',
  claim_amount: 'Claim Amount',
  approved_amount: 'Approved Amount',
  claim_difference_ratio: 'Claim Difference Ratio',
  witness_present: 'Witness Present',
  police_report_filed: 'Police Report Filed',
  fraud_reported_before: 'Fraud Reported Before',
  vehicle_year: 'Vehicle Year',
  vehicle_age_years: 'Vehicle Age (years)',
  vehicle_value_estimate: 'Vehicle Value',
  odometer_reading: 'Odometer (km)',
  accident_location_zip: 'Accident ZIP',
  driver_at_fault: 'Driver at Fault',
  driver_license_age_years: 'License Age (years)',
  passengers_in_vehicle: 'Passengers',
  passengers_other_vehicle: 'Passengers (Other)',
  repair_cost_estimate: 'Repair Cost',
  repair_duration_days: 'Repair Duration (days)',
  towed_from_scene: 'Towed from Scene',
  claim_to_vehicle_value_ratio: 'Claim/Vehicle Ratio',
  claims_near_policy_expiry_flag: 'Near Expiry Flag',
  multiple_claims_same_day_flag: 'Multiple Claims Flag',
  repair_shop_repeat_flag: 'Repeat Shop Flag',
  claimant_high_frequency_flag: 'High Frequency Flag',
  late_reporting_flag: 'Late Reporting Flag',
  suspicious_location_flag: 'Suspicious Location Flag',
  policy_recently_started_flag: 'Recently Started Flag',
  driver_owner_mismatch_flag: 'Driver/Owner Mismatch',
  reserving_amount: 'Reserving Amount',
  policy_type: 'Policy Type',
  customer_gender: 'Gender',
  customer_occupation: 'Occupation',
  customer_region: 'Region',
  submission_channel: 'Submission Channel',
  loss_cause: 'Loss Cause',
  initial_point_of_impact: 'Impact Point',
  injury_type: 'Injury Type',
  vehicle_make: 'Vehicle Make',
  vehicle_model: 'Vehicle Model',
  vehicle_ownership_type: 'Ownership Type',
  vehicle_usage_type: 'Usage Type',
  weather_condition: 'Weather',
}

// Binary (0/1) fields
const BINARY_FIELDS = new Set([
  'witness_present', 'police_report_filed', 'fraud_reported_before',
  'driver_at_fault', 'towed_from_scene',
  'claims_near_policy_expiry_flag', 'multiple_claims_same_day_flag',
  'repair_shop_repeat_flag', 'claimant_high_frequency_flag',
  'late_reporting_flag', 'suspicious_location_flag',
  'policy_recently_started_flag', 'driver_owner_mismatch_flag',
])

export default function ModelTestPage({ onBack }: { onBack: () => void }) {
  const [features, setFeatures] = useState<ModelFeatures | null>(null)
  const [values, setValues] = useState<Record<string, number | string>>({})
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/test-model/features`)
      .then(r => r.json())
      .then((data: ModelFeatures) => {
        setFeatures(data)
        setValues(data.defaults)
      })
      .catch(() => setError('Failed to load model features'))
  }, [])

  const handleChange = useCallback((key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }, [])

  const handleToggle = useCallback((key: string) => {
    setValues(prev => ({ ...prev, [key]: prev[key] === 1 || prev[key] === '1' ? 0 : 1 }))
  }, [])

  const handlePreset = useCallback((preset: 'low' | 'medium' | 'high') => {
    if (!features) return
    const base = { ...features.defaults }
    if (preset === 'high') {
      Object.assign(base, {
        claim_amount: 18000, approved_amount: 6000, claim_difference_ratio: 2.0,
        number_of_past_claims: 4, fraud_reported_before: 1, days_to_report_claim: 18,
        witness_present: 0, police_report_filed: 0, driver_at_fault: 1,
        claims_near_policy_expiry_flag: 1, multiple_claims_same_day_flag: 1,
        repair_shop_repeat_flag: 1, claimant_high_frequency_flag: 1,
        late_reporting_flag: 1, suspicious_location_flag: 1,
        policy_recently_started_flag: 1, driver_owner_mismatch_flag: 1,
        policy_tenure_years: 1, customer_age: 22, repair_cost_estimate: 16000,
        claim_to_vehicle_value_ratio: 0.28,
      })
    } else if (preset === 'medium') {
      Object.assign(base, {
        claim_amount: 12000, approved_amount: 8000, claim_difference_ratio: 0.5,
        number_of_past_claims: 2, fraud_reported_before: 1, days_to_report_claim: 8,
        witness_present: 0, police_report_filed: 1, driver_at_fault: 1,
        repair_shop_repeat_flag: 1, claimant_high_frequency_flag: 1,
        policy_tenure_years: 2, repair_cost_estimate: 10000,
      })
    }
    // low = defaults
    setValues(base)
    setResult(null)
  }, [features])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: Record<string, any> = {}
      for (const [k, v] of Object.entries(values)) {
        payload[k] = typeof v === 'string' && !isNaN(Number(v)) && !features?.text_cols.includes(k)
          ? Number(v) : v
      }
      console.log('[ModelTest] Sending payload:', JSON.stringify(payload, null, 2))
      const res = await fetch(`${API_BASE_URL}/api/test-model/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || res.statusText)
      }
      setResult(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!features) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          {error ? <p style={{ color: '#dc2626' }}>{error}</p> : <p>Loading model features...</p>}
        </div>
      </div>
    )
  }

  const riskColor = (level: string) =>
    level === 'CRITICAL' ? '#dc2626' : level === 'HIGH' ? '#ea580c' : level === 'MEDIUM' ? '#d97706' : '#16a34a'

  const maxImportance = result ? Math.max(...Object.values(result.feature_importance), 0.001) : 1

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px',
          cursor: 'pointer', fontSize: 13, color: '#374151',
        }}>Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
          XGBoost Fraud Model Tester
        </h1>
      </div>

      {/* Presets */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Presets:</span>
        {(['low', 'medium', 'high'] as const).map(p => (
          <button key={p} onClick={() => handlePreset(p)} style={{
            padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            background: p === 'high' ? '#fef2f2' : p === 'medium' ? '#fffbeb' : '#f0fdf4',
            color: p === 'high' ? '#dc2626' : p === 'medium' ? '#d97706' : '#16a34a',
          }}>
            {p} risk
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 380px' : '1fr', gap: 24 }}>
        {/* Left: Form */}
        <div>
          {/* Categorical / Text features */}
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: 14 }}>
              Categorical Features
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {features.text_cols.map(col => (
                <div key={col}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>
                    {LABELS[col] || col}
                  </label>
                  <select
                    value={String(values[col] ?? '')}
                    onChange={e => handleChange(col, e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                      fontSize: 13, background: '#fff',
                    }}
                  >
                    {(features.options[col] || []).map(opt => (
                      <option key={opt} value={opt}>{opt || '(none)'}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Numeric features */}
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: 14 }}>
              Numeric Features
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {features.num_cols.filter(c => !BINARY_FIELDS.has(c)).map(col => (
                <div key={col}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>
                    {LABELS[col] || col}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={values[col] ?? ''}
                    onChange={e => handleChange(col, e.target.value)}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                      fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Binary flags */}
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: 14 }}>
              Binary Flags
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {features.num_cols.filter(c => BINARY_FIELDS.has(c)).map(col => {
                const on = values[col] === 1 || values[col] === '1'
                return (
                  <button key={col} onClick={() => handleToggle(col)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    borderColor: on ? '#f87171' : '#d1d5db',
                    background: on ? '#fef2f2' : '#f9fafb',
                    color: on ? '#dc2626' : '#6b7280',
                  }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      background: on ? '#dc2626' : '#e5e7eb', color: '#fff',
                    }}>
                      {on ? '1' : '0'}
                    </span>
                    {LABELS[col] || col}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 700, letterSpacing: 0.3,
            background: loading ? '#9ca3af' : '#2563eb', color: '#fff',
          }}>
            {loading ? 'Running Model...' : 'Run Prediction'}
          </button>
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>

        {/* Right: Results */}
        {result && (
          <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
            {/* Probability gauge */}
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>
                Risk Level
              </div>
              <div style={{
                fontSize: 48, fontWeight: 800, lineHeight: 1,
                color: riskColor(result.risk_level),
              }}>
                {result.risk_level}
              </div>
              <div style={{
                display: 'inline-block', marginTop: 10, padding: '4px 14px', borderRadius: 20,
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                background: riskColor(result.risk_level) + '18',
                color: riskColor(result.risk_level),
              }}>
                {result.fraud_prediction === 1 ? 'Flagged' : 'Clean'}
              </div>

              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 14, lineHeight: 1.5 }}>
                {result.reasoning}
              </p>
            </div>

            {/* Feature Importance */}
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: 14 }}>
                Feature Importance
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(result.feature_importance).map(([name, imp]) => (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>
                        {LABELS[name] || name}
                      </span>
                      <span style={{ fontSize: 11, color: imp >= 0.3 ? '#dc2626' : imp >= 0.1 ? '#d97706' : '#9ca3af', fontWeight: imp >= 0.1 ? 600 : 400 }}>
                        {imp >= 0.3 ? 'High' : imp >= 0.1 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(imp / maxImportance) * 100}%`,
                        background: '#3b82f6',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
