"""
LangGraph pipeline orchestrator for the loss cause classification multi-agent system.

Flow:
  understanding → classification → [validation] → final_output

If validation fails: apply suggested_fix directly (no extra LLM call).
"""
from __future__ import annotations

from typing import Any, TypedDict
from langgraph.graph import END, StateGraph
from agents.understanding_agent import run_understanding_agent
from agents.classification_agent import run_classification_agent
from agents.validation_agent import run_validation_agent
from agents.final_output_agent import run_final_output_agent
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Pipeline State
# ---------------------------------------------------------------------------

class PipelineState(TypedDict):
    # Inputs
    claim_id: str
    claim_notes: str
    claim_pdfs: list[str]
    taxonomy: dict
    run_validation: bool

    # Agent outputs
    understanding_output: dict
    classification_output: dict           # original classification agent output (never overwritten)
    corrected_classification_output: dict | None  # set only when validation agent overrides
    validation_output: dict | None
    final_output: dict

    # Control
    validation_retry_done: bool
    error: str | None

    # Progress tracking (for streaming)
    current_step: str
    completed_steps: list[str]


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

def node_understanding(state: PipelineState) -> PipelineState:
    logger.info("pipeline_node", node="understanding", claim_id=state["claim_id"])
    try:
        output = run_understanding_agent(
            claim_id=state["claim_id"],
            claim_notes=state["claim_notes"],
            claim_pdfs=state.get("claim_pdfs", []),
        )
        return {
            **state,
            "understanding_output": output,
            "current_step": "classification",
            "completed_steps": state.get("completed_steps", []) + ["understanding"],
        }
    except Exception as e:
        logger.error("node_error", node="understanding", error=str(e))
        return {**state, "error": f"Understanding agent failed: {e}", "current_step": "error"}


def node_classification(state: PipelineState) -> PipelineState:
    logger.info("pipeline_node", node="classification", claim_id=state["claim_id"])
    try:
        output = run_classification_agent(
            claim_notes=state["claim_notes"],
            understanding_output=state["understanding_output"],
            taxonomy=state["taxonomy"],
            pdf_raw_extractions=state["understanding_output"].get("pdf_raw_extractions"),
        )
        return {
            **state,
            "classification_output": output,
            "current_step": "validation" if state.get("run_validation") else "final_output",
            "completed_steps": state.get("completed_steps", []) + ["classification"],
        }
    except Exception as e:
        logger.error("node_error", node="classification", error=str(e))
        return {**state, "error": f"Classification failed: {e}", "current_step": "error"}


def node_validation(state: PipelineState) -> PipelineState:
    logger.info("pipeline_node", node="validation", claim_id=state["claim_id"])
    try:
        output = run_validation_agent(
            claim_notes=state["claim_notes"],
            understanding_output=state["understanding_output"],
            classification_output=state["classification_output"],
            taxonomy=state["taxonomy"],
        )
        next_step = "final_output"
        if not output.get("is_valid", True) and not state.get("validation_retry_done"):
            # Only a real retry if fix differs from original
            fix = output.get("suggested_fix") or {}
            orig = state["classification_output"]
            if (
                fix.get("primary_cause", "").strip().lower() != orig.get("primary_cause", "").strip().lower()
                or fix.get("secondary_cause", "").strip().lower() != orig.get("secondary_cause", "").strip().lower()
                or fix.get("tertiary_cause", "").strip().lower() != orig.get("tertiary_cause", "").strip().lower()
            ):
                next_step = "classification_retry"
            else:
                output["is_valid"] = True
                output["suggested_fix"] = None
        return {
            **state,
            "validation_output": output,
            "current_step": next_step,
            "completed_steps": state.get("completed_steps", []) + ["validation"],
        }
    except Exception as e:
        logger.error("node_error", node="validation", error=str(e))
        return {**state, "error": f"Validation failed: {e}", "current_step": "final_output"}


def _grade_from_overall(overall: float) -> str:
    return "HIGH" if overall > 0.80 else "MEDIUM" if overall > 0.60 else "LOW"


def node_classification_retry(state: PipelineState) -> PipelineState:
    """Apply the validation agent's suggested fix — original classification_output preserved."""
    logger.info("pipeline_node", node="classification_retry", claim_id=state["claim_id"])
    try:
        validation = state.get("validation_output", {})
        fix = validation.get("suggested_fix", {})
        original = state["classification_output"]

        # Carry confidence scores from the fix; fall back to original scores
        orig_conf = original.get("confidence", {})
        p = float(fix.get("primary_confidence", orig_conf.get("primary", 0.0)))
        s = float(fix.get("secondary_confidence", orig_conf.get("secondary", 0.0)))
        t = float(fix.get("tertiary_confidence", orig_conf.get("tertiary", 0.0)))
        overall = round((p + s + t) / 3, 4)
        corrected_conf = {"primary": p, "secondary": s, "tertiary": t, "overall": overall}

        corrected = {
            **original,
            "primary_cause": fix.get("primary_cause", original.get("primary_cause", "")),
            "secondary_cause": fix.get("secondary_cause", original.get("secondary_cause", "")),
            "tertiary_cause": fix.get("tertiary_cause", original.get("tertiary_cause", "")),
            "confidence": corrected_conf,
            "classification_grade": _grade_from_overall(overall),
            "reasoning": fix.get("correction_reasoning") or validation.get("audit_notes", "Corrected by validation agent."),
        }

        return {
            **state,
            "corrected_classification_output": corrected,
            "validation_retry_done": True,
            "current_step": "final_output",
            "completed_steps": state.get("completed_steps", []) + ["classification_retry"],
        }
    except Exception as e:
        logger.error("node_error", node="classification_retry", error=str(e))
        return {**state, "error": f"Classification retry failed: {e}", "current_step": "final_output"}


def node_final_output(state: PipelineState) -> PipelineState:
    logger.info("pipeline_node", node="final_output", claim_id=state["claim_id"])
    try:
        effective_classification = state.get("corrected_classification_output") or state["classification_output"]
        output = run_final_output_agent(
            understanding_output=state["understanding_output"],
            classification_output=effective_classification,
            validation_output=state.get("validation_output"),
        )
        return {
            **state,
            "final_output": output,
            "current_step": "complete",
            "completed_steps": state.get("completed_steps", []) + ["final_output"],
        }
    except Exception as e:
        logger.error("node_error", node="final_output", error=str(e))
        return {**state, "error": f"Final output failed: {e}", "current_step": "error"}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def route_after_classification(state: PipelineState) -> str:
    if state.get("error"):
        return "end"
    if state.get("run_validation"):
        return "validation"
    return "final_output"


def route_after_validation(state: PipelineState) -> str:
    if state.get("error"):
        return "final_output"
    if state.get("current_step") == "classification_retry":
        return "classification_retry"
    return "final_output"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_pipeline() -> Any:
    graph = StateGraph(PipelineState)

    graph.add_node("understanding", node_understanding)
    graph.add_node("classification", node_classification)
    graph.add_node("validation", node_validation)
    graph.add_node("classification_retry", node_classification_retry)
    graph.add_node("final_output", node_final_output)

    graph.set_entry_point("understanding")

    graph.add_edge("understanding", "classification")

    graph.add_conditional_edges(
        "classification",
        route_after_classification,
        {
            "validation": "validation",
            "final_output": "final_output",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "validation",
        route_after_validation,
        {
            "classification_retry": "classification_retry",
            "final_output": "final_output",
        },
    )

    graph.add_edge("classification_retry", "final_output")
    graph.add_edge("final_output", END)

    return graph.compile()


_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = build_pipeline()
    return _pipeline


def run_pipeline(
    claim_id: str,
    claim_notes: str,
    claim_pdfs: list[str],
    taxonomy: dict,
    run_validation: bool = False,
) -> dict:
    """Execute the full pipeline for a single claim. Returns the complete pipeline state."""
    pipeline = get_pipeline()

    initial_state = PipelineState(
        claim_id=claim_id,
        claim_notes=claim_notes,
        claim_pdfs=claim_pdfs or [],
        taxonomy=taxonomy,
        run_validation=run_validation,
        understanding_output={},
        classification_output={},
        corrected_classification_output=None,
        validation_output=None,
        final_output={},
        validation_retry_done=False,
        error=None,
        current_step="understanding",
        completed_steps=[],
    )

    final_state = pipeline.invoke(initial_state)
    return dict(final_state)
