"""Data ingestion and validation service."""
import io
from typing import Tuple
import pandas as pd
from utils.logger import get_logger

logger = get_logger(__name__)

MANDATORY_COLUMNS = {"claim_id", "claim_notes"}
OPTIONAL_COLUMNS = {"claim_pdfs"}


def parse_upload(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, list[str]]:
    """
    Parse uploaded CSV or Excel file.
    Returns (dataframe, list_of_errors).
    """
    errors = []

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            return pd.DataFrame(), ["Unsupported file format. Upload CSV or Excel."]
    except Exception as e:
        return pd.DataFrame(), [f"Failed to parse file: {str(e)}"]

    missing = MANDATORY_COLUMNS - set(df.columns.str.lower().str.strip())
    if missing:
        errors.append(f"Missing mandatory columns: {', '.join(sorted(missing))}")

    if errors:
        return df, errors

    # Normalize column names to lowercase
    df.columns = df.columns.str.lower().str.strip()

    # Coerce claim_id to string
    df["claim_id"] = df["claim_id"].astype(str).str.strip()
    df["claim_notes"] = df["claim_notes"].astype(str).str.strip()

    # Handle claim_pdfs column
    if "claim_pdfs" not in df.columns:
        df["claim_pdfs"] = None

    # Remove completely empty rows
    df = df.dropna(subset=["claim_notes"])
    df = df[df["claim_notes"].str.len() > 0]

    logger.info("data_parsed", rows=len(df), columns=list(df.columns))
    return df, []


def df_to_claims(df: pd.DataFrame) -> list[dict]:
    """Convert dataframe to list of claim dicts."""
    claims = []
    for _, row in df.iterrows():
        claim = {
            "claim_id": str(row["claim_id"]),
            "claim_notes": str(row["claim_notes"]),
            "claim_pdfs": _parse_pdf_paths(row.get("claim_pdfs")),
            "extra_fields": {
                k: v for k, v in row.items()
                if k not in {"claim_id", "claim_notes", "claim_pdfs"}
            },
        }
        claims.append(claim)
    return claims


def _parse_pdf_paths(val) -> list[str]:
    if val is None or (isinstance(val, float)):
        return []
    raw = str(val).strip()
    if not raw or raw.lower() in {"nan", "none", ""}:
        return []

    # Handle Python list representation: ['path1', 'path2'] or ["path1"]
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        paths = [p.strip().strip("\"'").strip() for p in inner.split(",")]
        return [p for p in paths if p]

    # Semicolon-separated (primary documented format)
    if ";" in raw:
        return [p.strip() for p in raw.split(";") if p.strip()]

    # Comma-separated fallback
    if "," in raw:
        return [p.strip() for p in raw.split(",") if p.strip()]

    return [raw]
