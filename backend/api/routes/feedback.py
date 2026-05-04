"""Feedback routes — user corrections and remarks fed to the Human Feedback Agent."""
from fastapi import APIRouter, HTTPException
from api.models.request_models import FeedbackRemarkRequest, ManualCorrectionRequest
from api.models.response_models import LearningResponse
from agents.learning_agent import process_user_remark, process_manual_correction
from services.learning_store import get_active_rules, get_all_corrections
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/remark", response_model=LearningResponse)
async def submit_remark(request: FeedbackRemarkRequest):
    """
    Submit a free-text remark about a misclassification.
    The Human Feedback Agent will extract a reusable rule from it.
    """
    try:
        result = process_user_remark(
            claim_id=request.claim_id,
            claim_notes=request.claim_notes,
            classification=request.classification,
            user_remark=request.user_remark,
        )
        return LearningResponse(
            status="success",
            message="Remark processed. New classification rule extracted and stored.",
            rule=result,
        )
    except Exception as e:
        logger.error("remark_processing_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process remark: {e}")


@router.post("/correction", response_model=LearningResponse)
async def submit_correction(request: ManualCorrectionRequest):
    """
    Submit a manual classification correction.
    Stored for audit and future fine-tuning.
    """
    try:
        result = process_manual_correction(
            claim_id=request.claim_id,
            claim_notes=request.claim_notes,
            original_classification=request.original_classification,
            corrected_classification=request.corrected_classification,
        )
        return LearningResponse(
            status="success",
            message="Correction recorded successfully.",
            correction=result,
        )
    except Exception as e:
        logger.error("correction_processing_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to store correction: {e}")


@router.get("/rules")
async def get_rules():
    """Return all active learned rules."""
    return {"rules": get_active_rules()}


@router.get("/corrections")
async def get_corrections():
    """Return all stored manual corrections."""
    return {"corrections": get_all_corrections()}
