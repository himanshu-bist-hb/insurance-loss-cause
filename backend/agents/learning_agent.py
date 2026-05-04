"""
Human Feedback Agent — processes user feedback to dynamically improve classification prompts.
"""
import json
from config.prompts import LEARNING_AGENT_SYSTEM, LEARNING_AGENT_PROMPT
from services.llm_service import call_llm
from services.learning_store import add_rule, add_correction, get_active_rules
from utils.logger import get_logger

logger = get_logger(__name__)


def process_user_remark(
    claim_id: str,
    claim_notes: str,
    classification: dict,
    user_remark: str,
) -> dict:
    """
    Process a free-text remark from the user.
    Extracts a reusable rule and stores it for future prompts.

    Returns the extracted rule dict.
    """
    logger.info("learning_agent_remark_start", claim_id=claim_id)

    existing_rules = get_active_rules()
    existing_text = json.dumps(
        [r.get("extracted_rule", "") for r in existing_rules], indent=2
    )

    prompt = LEARNING_AGENT_PROMPT.format(
        user_feedback=user_remark,
        claim_id=claim_id,
        claim_notes=claim_notes[:500],
        classification=json.dumps(classification, indent=2),
        existing_rules=existing_text,
    )

    result = call_llm(prompt=prompt, system_prompt=LEARNING_AGENT_SYSTEM)

    result.setdefault("extracted_rule", "")
    result.setdefault("rule_category", "general")
    result.setdefault("applies_to", "")
    result.setdefault("conflicts_with", [])
    result.setdefault("confidence", 0.8)

    if result.get("extracted_rule"):
        add_rule(result)
        logger.info("learning_rule_added", rule=result["extracted_rule"][:100])

    return result


def process_manual_correction(
    claim_id: str,
    claim_notes: str,
    original_classification: dict,
    corrected_classification: dict,
) -> dict:
    """
    Store a manual correction without LLM involvement.
    Returns the stored correction record.
    """
    logger.info("learning_agent_correction_start", claim_id=claim_id)

    correction = {
        "claim_id": claim_id,
        "claim_notes_excerpt": claim_notes[:200],
        "original": original_classification,
        "corrected": corrected_classification,
    }
    add_correction(correction)

    return {
        "status": "correction_stored",
        "claim_id": claim_id,
        "correction": correction,
    }
