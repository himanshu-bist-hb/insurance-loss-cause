"""
Cause Identifier Agent — identifies root causes and builds causal chains.
"""
import json
from config.prompts import CAUSE_IDENTIFIER_SYSTEM, CAUSE_IDENTIFIER_PROMPT
from services.llm_service import call_llm
from services.learning_store import get_rules_as_text
from utils.logger import get_logger

logger = get_logger(__name__)


def run_cause_identifier_agent(understanding_output: dict) -> dict:
    """
    Identifies causal chains from the understanding output.

    Returns:
        {
            "causal_chain": str,
            "root_cause": str,
            "proximate_cause": str,
            "possible_causes": list[dict]
        }
    """
    logger.info("cause_identifier_agent_start")

    dynamic_rules = get_rules_as_text()

    prompt = CAUSE_IDENTIFIER_PROMPT.format(
        incident_summary=understanding_output.get("incident_summary", ""),
        event_sequence=json.dumps(understanding_output.get("event_sequence", []), indent=2),
        damage_types=json.dumps(understanding_output.get("damage_types", []), indent=2),
        signals=json.dumps(understanding_output.get("signals", []), indent=2),
        dynamic_rules=f"\n{dynamic_rules}\n" if dynamic_rules else "",
    )

    result = call_llm(prompt=prompt, system_prompt=CAUSE_IDENTIFIER_SYSTEM)

    result.setdefault("causal_chain", "")
    result.setdefault("root_cause", "")
    result.setdefault("proximate_cause", "")
    result.setdefault("possible_causes", [])

    logger.info(
        "cause_identifier_agent_complete",
        possible_causes_count=len(result.get("possible_causes", [])),
    )
    return result
