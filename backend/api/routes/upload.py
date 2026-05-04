"""Upload route — handles CSV/Excel ingestion and session creation."""
import uuid
import os
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.data_service import parse_upload, df_to_claims
from api.models.response_models import UploadResponse
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory session store (use Redis in production)
_sessions: dict[str, dict] = {}


@router.post("/claims", response_model=UploadResponse)
async def upload_claims(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file containing claim data.
    Returns a session_id and preview of the data.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_ext = {".csv", ".xlsx", ".xls"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_ext)}"
        )

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.max_file_size_mb}MB"
        )

    df, errors = parse_upload(content, file.filename)

    if errors and df.empty:
        return UploadResponse(
            session_id="",
            row_count=0,
            columns=[],
            preview=[],
            errors=errors,
            success=False,
        )

    session_id = str(uuid.uuid4())
    claims = df_to_claims(df)
    _sessions[session_id] = {"claims": claims, "df_columns": list(df.columns)}

    preview_df = df.head(10)
    preview = preview_df.where(preview_df.notna(), None).to_dict(orient="records")

    logger.info("upload_complete", session_id=session_id, rows=len(claims))

    return UploadResponse(
        session_id=session_id,
        row_count=len(claims),
        columns=list(df.columns),
        preview=preview,
        errors=errors,
        success=True,
    )


def get_session(session_id: str) -> dict:
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return session
