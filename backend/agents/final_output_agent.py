"""
Final Output Agent — synthesizes all agent outputs into the authoritative record.
"""
import json
from config.prompts import FINAL_OUTPUT_AGENT_SYSTEM, FINAL_OUTPUT_AGENT_PROMPT
from services.llm_service import call_llm
from utils.logger import get_logger

logger = get_logger(__name__)


def run_final_output_agent(
    understanding_output: dict,
    classification_output: dict,
    validation_output: dict | None,
) -> dict:
    """
    Produces the final authoritative classification record.

    Returns:
        {
            "final_classification": {"primary_cause", "secondary_cause", "tertiary_cause"},
            "confidence_score": float,
            "classification_grade": str,
            "alternative_causes": list[dict],
            "reason": str,
            "audit_trail": dict
        }
    """
    logger.info("final_output_agent_start")

    prompt = FINAL_OUTPUT_AGENT_PROMPT.format(
        understanding_output=json.dumps(understanding_output, indent=2),
        classification_output=json.dumps(classification_output, indent=2),
        validation_output=json.dumps(validation_output or {"status": "skipped"}, indent=2),
    )

    result = call_llm(prompt=prompt, system_prompt=FINAL_OUTPUT_AGENT_SYSTEM)

    result.setdefault("final_classification", {
        "primary_cause": classification_output.get("primary_cause", "Unknown"),
        "secondary_cause": classification_output.get("secondary_cause", "Unknown"),
        "tertiary_cause": classification_output.get("tertiary_cause", "Unknown"),
    })
    result.setdefault("alternative_causes", [])
    result.setdefault("reason", "")
    result.setdefault("audit_trail", {})

    # Compute confidence_score as average of classification tier confidences (not from LLM)
    conf = classification_output.get("confidence", {})
    if isinstance(conf, dict):
        p = float(conf.get("primary", 0.0))
        s = float(conf.get("secondary", 0.0))
        t = float(conf.get("tertiary", 0.0))
        overall = round((p + s + t) / 3, 4)
    else:
        overall = 0.0
    result["confidence_score"] = overall
    result["classification_grade"] = "HIGH" if overall > 0.80 else "MEDIUM" if overall > 0.60 else "LOW"

    logger.info(
        "final_output_agent_complete",
        classification=result["final_classification"],
        confidence=result["confidence_score"],
        grade=result["classification_grade"],
    )
    return result
