"""
Understanding Agent — extracts structured meaning from claim notes and PDFs.
"""
from config.prompts import (
    UNDERSTANDING_AGENT_SYSTEM,
    UNDERSTANDING_AGENT_PROMPT,
    PDF_SUMMARY_SYSTEM,
    PDF_SUMMARY_PROMPT,
)
from services.llm_service import call_llm, call_llm_text
from services.pdf_service import extract_text_from_pdfs
from services.pii_service import remove_pii
from utils.logger import get_logger

logger = get_logger(__name__)

# Max chars sent to the PDF summary LLM per document to stay within token budget.
_PDF_CHAR_LIMIT = 12000


def _generate_pdf_summary(pdf_texts: dict[str, str]) -> str | None:
    """
    Dedicated, focused LLM call that summarises PDF content as plain text.
    Raw text is truncated per document so the prompt stays manageable.
    """
    combined = "\n\n---\n\n".join(
        f"[Document: {path}]\n{remove_pii(text[:_PDF_CHAR_LIMIT])}"
        + ("... [truncated]" if len(text) > _PDF_CHAR_LIMIT else "")
        for path, text in pdf_texts.items()
    )
    prompt = PDF_SUMMARY_PROMPT.format(pdf_content=combined)
    try:
        return call_llm_text(prompt=prompt, system_prompt=PDF_SUMMARY_SYSTEM)
    except Exception as e:
        logger.warning("pdf_summary_failed", error=str(e))
        return None


def run_understanding_agent(
    claim_id: str,
    claim_notes: str,
    claim_pdfs: list[str],
) -> dict:
    """
    Extracts structured understanding from a claim.

    Returns:
        {
            "incident_summary": str,
            "event_sequence": list[str],
            "entities": list[dict],
            "damage_types": list[str],
            "pdf_summary": str | None,
            "pdf_raw_extractions": list[{"path": str, "text": str}],
            "signals": list[str]
        }
    """
    logger.info("understanding_agent_start", claim_id=claim_id, has_pdfs=bool(claim_pdfs))

    # ── Step 1: Extract raw text from each PDF ──────────────────────────────
    pdf_raw_extractions: list[dict] = []
    pdf_summary: str | None = None
    pdf_section = ""

    if claim_pdfs:
        pdf_texts = extract_text_from_pdfs(claim_pdfs)
        if pdf_texts:
            pdf_raw_extractions = [
                {"path": path, "text": text}
                for path, text in pdf_texts.items()
            ]
            # ── Step 2: Generate PDF summary via its own focused LLM call ───
            pdf_summary = _generate_pdf_summary(pdf_texts)
            if pdf_summary:
                pdf_section = f"\nPDF DOCUMENT SUMMARY:\n{pdf_summary}"
            else:
                pdf_section = "\nPDF DOCUMENTS: Attached but summary generation failed."
        else:
            pdf_section = "\nPDF DOCUMENTS: Files provided but could not be read."

    # ── Step 3: Run main understanding analysis (PII removed from notes) ──────
    prompt = UNDERSTANDING_AGENT_PROMPT.format(
        claim_id=claim_id,
        claim_notes=remove_pii(claim_notes),
        pdf_section=pdf_section,
    )

    result = call_llm(prompt=prompt, system_prompt=UNDERSTANDING_AGENT_SYSTEM)

    # Ensure required keys with defaults
    result.setdefault("incident_summary", "")
    result.setdefault("event_sequence", [])
    result.setdefault("entities", [])
    result.setdefault("damage_types", [])
    result.setdefault("signals", [])

    # Attach PDF artefacts — these are always set by our code, not the LLM
    result["pdf_summary"] = pdf_summary
    result["pdf_raw_extractions"] = pdf_raw_extractions

    logger.info(
        "understanding_agent_complete",
        claim_id=claim_id,
        signals_count=len(result.get("signals", [])),
        has_pdf_summary=bool(pdf_summary),
        pdf_docs=len(pdf_raw_extractions),
    )
    return result
