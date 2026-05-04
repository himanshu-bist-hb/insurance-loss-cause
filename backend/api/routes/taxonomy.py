"""Taxonomy routes — load defaults and accept custom uploads."""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from services.taxonomy_service import (
    load_default_taxonomy,
    parse_taxonomy_upload,
    get_available_lobs,
)
from api.models.response_models import TaxonomyResponse
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


@router.get("/lobs")
async def get_lobs():
    """Return available lines of business."""
    return {"lobs": get_available_lobs()}


@router.get("/default", response_model=TaxonomyResponse)
async def get_default_taxonomy(lob: str = Query(..., description="Line of business")):
    """Load the pre-saved taxonomy for a given LOB."""
    try:
        taxonomy = load_default_taxonomy(lob)
        return TaxonomyResponse(
            lob=lob,
            taxonomy=taxonomy,
            primary_count=len(taxonomy),
        )
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/upload", response_model=TaxonomyResponse)
async def upload_taxonomy(lob: str = Query(...), file: UploadFile = File(...)):
    """
    Upload a custom taxonomy file.
    Accepted formats:
      - CSV  (.csv)  — columns: primary_cause, secondary_cause, tertiary_cause
      - Excel (.xlsx/.xls) — same columns
      - JSON (.json) — nested dict: {primary: {secondary: [tertiary, ...]}}
    """
    allowed_ext = {".csv", ".xlsx", ".xls", ".json"}
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Upload CSV, Excel (.xlsx), or JSON."
        )

    content = await file.read()
    try:
        taxonomy = parse_taxonomy_upload(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    logger.info("taxonomy_uploaded", lob=lob, primary_count=len(taxonomy))
    return TaxonomyResponse(
        lob=lob,
        taxonomy=taxonomy,
        primary_count=len(taxonomy),
    )


@router.post("/validate")
async def validate_taxonomy(taxonomy: dict):
    """Validate a taxonomy dict without uploading."""
    from services.taxonomy_service import validate_taxonomy as _validate
    try:
        _validate(taxonomy)
        return {"valid": True, "primary_count": len(taxonomy)}
    except ValueError as e:
        return {"valid": False, "error": str(e)}
