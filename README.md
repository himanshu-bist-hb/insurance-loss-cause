# Loss Cause Agent

Production-grade multi-agent AI system for insurance loss cause classification using a 3-tier taxonomy.

---

## Architecture

```
loss-cause-agent/
├── backend/                    # FastAPI + LangGraph
│   ├── agents/
│   │   ├── understanding_agent.py      # Extracts structured meaning from claims + PDFs
│   │   ├── cause_identifier_agent.py   # Root cause analysis + causal chain
│   │   ├── classification_agent.py     # 3-tier taxonomy classification
│   │   ├── validation_agent.py         # Optional classification audit
│   │   ├── learning_agent.py           # User feedback → dynamic prompt rules
│   │   ├── final_output_agent.py       # Synthesizes authoritative record
│   │   └── pipeline.py                 # LangGraph StateGraph orchestration
│   ├── services/
│   │   ├── llm_service.py              # Azure OpenAI — single call point
│   │   ├── pdf_service.py              # PDF extraction (pdfplumber + PyPDF2)
│   │   ├── data_service.py             # CSV/Excel ingestion + validation
│   │   ├── taxonomy_service.py         # Taxonomy loading + validation
│   │   └── learning_store.py           # Persistent rule + correction store
│   ├── api/
│   │   ├── routes/upload.py            # POST /upload/claims
│   │   ├── routes/analysis.py          # POST /analysis/run  (+ SSE stream)
│   │   ├── routes/taxonomy.py          # GET/POST /taxonomy/*
│   │   └── routes/feedback.py          # POST /feedback/remark|correction
│   ├── config/
│   │   ├── settings.py                 # Pydantic Settings (env vars)
│   │   └── prompts.py                  # All agent system + user prompts
│   ├── data/
│   │   ├── sample_claims.csv
│   │   ├── es_taxonomy.json
│   │   └── auto_taxonomy.json
│   └── main.py
│
└── frontend/                   # React + Vite + Tailwind
    └── src/
        ├── components/
        │   ├── LOBSelector.jsx
        │   ├── DataUpload.jsx
        │   ├── TaxonomySelector.jsx
        │   ├── RunPipeline.jsx         # SSE-driven live progress
        │   ├── AgentFlowGraph.jsx      # ReactFlow pipeline visualization
        │   ├── ResultsTable.jsx        # Expandable results + feedback UI
        │   ├── LearningRulesPanel.jsx  # Active learned rules
        │   └── JsonViewer.jsx          # Collapsible JSON explorer
        └── pages/Dashboard.jsx
```

---

## Agent Pipeline

```
Understanding → Cause Identifier → Classification → [Validation] → Final Output
                                          ↑                |
                                          └── Retry ←──────┘ (if invalid)
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Copy and fill in your Azure OpenAI keys
cp .env.example .env
# Edit .env: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME

# Install dependencies (use existing venv or create new)
pip install -r requirements.txt

# Run the API
python main.py
# or: uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

npm install
npm run dev
```

UI: http://localhost:5173

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `sk-...` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | `https://myresource.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Deployment/model name | `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-08-01-preview` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |

---

## Sample Data

`backend/data/sample_claims.csv` — 10 realistic E&S claims covering:
- Electrical panel fire (short circuit)
- Burst frozen pipe (water damage)
- Commercial vehicle break-in (theft)
- Hurricane roof damage (wind/hail)
- Slip and fall (premises liability)
- Wildfire (external fire)
- Hail (storm)
- Ransomware attack (cyber theft)
- HVAC compressor failure (equipment breakdown)
- Roof collapse under snow load (structural collapse)

---

## Taxonomy Format

Custom taxonomy must follow this nested JSON structure:

```json
{
  "Primary Category": {
    "Secondary Category": [
      "Tertiary Cause 1",
      "Tertiary Cause 2"
    ]
  }
}
```

---

## Learning Agent

The system improves over time through two feedback mechanisms:

**1. User Remark** — Natural language feedback on a misclassification:
> "Short circuit cases are often misclassified as general fire. The electrical fault is always the root cause."

The Learning Agent extracts a precise rule and injects it into all future Classification Agent prompts.

**2. Manual Correction** — Direct edit of primary/secondary/tertiary classification. Stored as a correction record for audit and future fine-tuning.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/upload/claims` | Upload CSV/Excel |
| `GET` | `/api/v1/taxonomy/default?lob=excess_and_surplus` | Load default taxonomy |
| `POST` | `/api/v1/taxonomy/upload?lob=auto` | Upload custom taxonomy |
| `POST` | `/api/v1/analysis/run` | Run full pipeline (batch) |
| `POST` | `/api/v1/analysis/run/stream` | Run pipeline with SSE streaming |
| `POST` | `/api/v1/feedback/remark` | Submit remark → extract rule |
| `POST` | `/api/v1/feedback/correction` | Submit manual correction |
| `GET` | `/api/v1/feedback/rules` | Get all active learned rules |
| `GET` | `/health` | Health check |
