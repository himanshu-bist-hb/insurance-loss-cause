"""
Validation Agent — audits classification correctness. Optional and user-controlled.
"""
import json
from config.prompts import VALIDATION_AGENT_SYSTEM, VALIDATION_AGENT_PROMPT
from services.llm_service import call_llm
from services.taxonomy_service import get_taxonomy_as_text
from utils.logger import get_logger

logger = get_logger(__name__)


def _is_in_taxonomy(taxonomy: dict, primary: str, secondary: str, tertiary: str) -> bool:
    """Return True only if all three levels exist verbatim in the taxonomy dict."""
    if primary not in taxonomy:
        return False
    secondary_map = taxonomy.get(primary, {})
    if not isinstance(secondary_map, dict) or secondary not in secondary_map:
        return False
    tertiary_list = secondary_map.get(secondary, [])
    return isinstance(tertiary_list, list) and tertiary in tertiary_list


def run_validation_agent(
    claim_notes: str,
    understanding_output: dict,
    classification_output: dict,
    taxonomy: dict,
) -> dict:
    """
    Validates the classification against the original claim.

    Returns:
        {
            "is_valid": bool,
            "validation_score": float,
            "issues": list[str],
            "suggested_fix": dict | None,
            "confidence_adjustment": float,
            "audit_notes": str
        }
    """
    logger.info("validation_agent_start")

    taxonomy_text = get_taxonomy_as_text(taxonomy)
    pdf_summary = understanding_output.get("pdf_summary") or "No PDF documents provided."

    prompt = VALIDATION_AGENT_PROMPT.format(
        claim_notes=claim_notes,
        pdf_summary=pdf_summary,
        incident_summary=understanding_output.get("incident_summary", ""),
        primary_cause=classification_output.get("primary_cause", ""),
        secondary_cause=classification_output.get("secondary_cause", ""),
        tertiary_cause=classification_output.get("tertiary_cause", ""),
        classification_reasoning=classification_output.get("reasoning", ""),
        taxonomy=taxonomy_text,
    )

    result = call_llm(prompt=prompt, system_prompt=VALIDATION_AGENT_SYSTEM)

    result.setdefault("is_valid", True)
    result.setdefault("validation_score", 1.0)
    result.setdefault("issues", [])
    result.setdefault("suggested_fix", None)
    result.setdefault("confidence_adjustment", 0.0)
    result.setdefault("audit_notes", "")

    # Reject suggested_fix if any level is not verbatim in the taxonomy
    fix = result.get("suggested_fix")
    if fix:
        if not _is_in_taxonomy(
            taxonomy,
            fix.get("primary_cause", ""),
            fix.get("secondary_cause", ""),
            fix.get("tertiary_cause", ""),
        ):
            result["is_valid"] = True
            result["suggested_fix"] = None
            result["audit_notes"] = (
                (result["audit_notes"] + " ") if result["audit_notes"] else ""
            ) + "[Suggested fix rejected: one or more values not found verbatim in taxonomy.]"
            logger.warning("validation_fix_rejected_not_in_taxonomy", fix=fix)

    logger.info(
        "validation_agent_complete",
        is_valid=result["is_valid"],
        issues_count=len(result.get("issues", [])),
    )
    return result
