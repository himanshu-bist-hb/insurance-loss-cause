from pydantic import BaseModel, Field
from typing import Optional


class RunAnalysisRequest(BaseModel):
    lob: str = Field(..., description="Line of business: auto | excess_and_surplus")
    taxonomy: dict = Field(..., description="Nested taxonomy dict")
    run_validation: bool = Field(default=False)
    validate_claim_ids: Optional[list[str]] = Field(
        default=None,
        description="Specific claim IDs to validate. None = all claims if run_validation=True"
    )
    claim_ids: Optional[list[str]] = Field(
        default=None,
        description="Specific claim IDs to process. None = all claims in session"
    )
    session_id: str = Field(..., description="Session ID from upload step")


class FeedbackRemarkRequest(BaseModel):
    session_id: str
    claim_id: str
    claim_notes: str
    classification: dict
    user_remark: str


class ManualCorrectionRequest(BaseModel):
    session_id: str
    claim_id: str
    claim_notes: str
    original_classification: dict
    corrected_classification: dict


class TaxonomyUploadResponse(BaseModel):
    taxonomy: dict
    primary_count: int
    secondary_count: int
    tertiary_count: int
