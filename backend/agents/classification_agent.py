"""
Classification Agent — maps claims to a 3-tier taxonomy.
Uses original claim notes + PDF data directly (no cause identifier step).
PII is stripped before any text reaches the LLM.
"""
import json
from config.prompts import CLASSIFICATION_AGENT_SYSTEM, CLASSIFICATION_AGENT_PROMPT
from services.llm_service import call_llm
from services.learning_store import get_rules_as_text
from services.taxonomy_service import get_taxonomy_as_text
from services.pii_service import remove_pii
from utils.logger import get_logger

logger = get_logger(__name__)

_PDF_SNIPPET_CHARS = 8000  # max chars of raw PDF text sent per document


def run_classification_agent(
    claim_notes: str,
    understanding_output: dict,
    taxonomy: dict,
    pdf_raw_extractions: list[dict] | None = None,
) -> dict:
    """
    Classifies a claim into the provided taxonomy.

    Returns:
        {
            "primary_cause": str,
            "secondary_cause": str,
            "tertiary_cause": str,
            "confidence": {"primary": float, "secondary": float, "tertiary": float, "overall": float},
            "reasoning": str,
            "alternative_classifications": list[dict]
        }
    """
    logger.info("classification_agent_start")

    dynamic_rules = get_rules_as_text()
    taxonomy_text = get_taxonomy_as_text(taxonomy)

    # ── PII-clean claim notes ───────────────────────────────────────────────
    clean_notes = remove_pii(claim_notes or "")

    # ── PDF context: prefer the pre-generated summary; fall back to raw snippet ──
    pdf_summary = understanding_output.get("pdf_summary") or ""
    if not pdf_summary and pdf_raw_extractions:
        snippets = []
        for item in pdf_raw_extractions:
            raw = item.get("text", "")
            snippet = remove_pii(raw[:_PDF_SNIPPET_CHARS])
            if snippet:
                snippets.append(f"[{item.get('path', 'PDF')}]\n{snippet}")
        pdf_summary = "\n\n---\n\n".join(snippets) if snippets else "No PDF content available."

    prompt = CLASSIFICATION_AGENT_PROMPT.format(
        taxonomy=taxonomy_text,
        claim_notes=clean_notes,
        pdf_summary=pdf_summary or "No PDF documents provided.",
        incident_summary=understanding_output.get("incident_summary", ""),
        event_sequence=json.dumps(understanding_output.get("event_sequence", []), indent=2),
        damage_types=json.dumps(understanding_output.get("damage_types", []), indent=2),
        signals=json.dumps(understanding_output.get("signals", []), indent=2),
        dynamic_rules=f"\n{dynamic_rules}\n" if dynamic_rules else "",
    )

    result = call_llm(prompt=prompt, system_prompt=CLASSIFICATION_AGENT_SYSTEM)

    result.setdefault("primary_cause", "Unknown")
    result.setdefault("secondary_cause", "Unknown")
    result.setdefault("tertiary_cause", "Unknown")
    result.setdefault("confidence", {"primary": 0.0, "secondary": 0.0, "tertiary": 0.0, "overall": 0.0})
    result.setdefault("reasoning", "")
    result.setdefault("alternative_classifications", [])

    # Compute overall confidence as average of tier confidences (ignore LLM-provided overall)
    conf = result["confidence"] if isinstance(result.get("confidence"), dict) else {}
    p = float(conf.get("primary", 0.0))
    s = float(conf.get("secondary", 0.0))
    t = float(conf.get("tertiary", 0.0))
    overall = round((p + s + t) / 3, 4)
    result["confidence"] = {"primary": p, "secondary": s, "tertiary": t, "overall": overall}
    result["classification_grade"] = "HIGH" if overall > 0.80 else "MEDIUM" if overall > 0.60 else "LOW"

    logger.info(
        "classification_agent_complete",
        primary=result["primary_cause"],
        secondary=result["secondary_cause"],
        confidence=overall,
        grade=result["classification_grade"],
    )
    return result
