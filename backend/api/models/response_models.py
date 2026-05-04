from pydantic import BaseModel
from typing import Optional, Any


class UploadResponse(BaseModel):
    session_id: str
    row_count: int
    columns: list[str]
    preview: list[dict]
    errors: list[str]
    success: bool


class ClaimResult(BaseModel):
    claim_id: str
    status: str  # success | error
    error: Optional[str] = None
    understanding_output: Optional[dict] = None
    classification_output: Optional[dict] = None
    validation_output: Optional[dict] = None
    final_output: Optional[dict] = None
    completed_steps: list[str] = []


class AnalysisResponse(BaseModel):
    session_id: str
    total_claims: int
    processed: int
    failed: int
    results: list[ClaimResult]


class LearningResponse(BaseModel):
    status: str
    message: str
    rule: Optional[dict] = None
    correction: Optional[dict] = None


class TaxonomyResponse(BaseModel):
    lob: str
    taxonomy: dict
    primary_count: int


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
