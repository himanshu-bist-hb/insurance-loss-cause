import axios from 'axios'

const BASE_URL = '/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 min for long pipeline runs
})

// ─── Upload ──────────────────────────────────────────────────────────────────

export async function uploadClaims(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload/claims', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export async function getDefaultTaxonomy(lob) {
  const { data } = await api.get('/taxonomy/default', { params: { lob } })
  return data
}

export async function uploadTaxonomy(lob, file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/taxonomy/upload', form, {
    params: { lob },
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function validateTaxonomy(taxonomy) {
  const { data } = await api.post('/taxonomy/validate', taxonomy)
  return data
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export async function runAnalysis(payload) {
  const { data } = await api.post('/analysis/run', payload)
  return data
}

export function runAnalysisStream(payload, onEvent, onComplete, onError) {
  const url = `${BASE_URL}/analysis/run/stream`

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      function pump() {
        reader.read().then(({ done, value }) => {
          if (done) {
            onComplete?.()
            return
          }
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                onEvent(event)
              } catch {
                // skip malformed lines
              }
            }
          }
          pump()
        })
      }
      pump()
    })
    .catch(onError)
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export async function submitRemark(payload) {
  const { data } = await api.post('/feedback/remark', payload)
  return data
}

export async function submitCorrection(payload) {
  const { data } = await api.post('/feedback/correction', payload)
  return data
}

export async function getLearningRules() {
  const { data } = await api.get('/feedback/rules')
  return data
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  const { data } = await api.get('../../health')
  return data
}
