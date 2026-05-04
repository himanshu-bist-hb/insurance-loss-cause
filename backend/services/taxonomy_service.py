"""Taxonomy loading, validation, and management service."""
import io
import json
import os
import pandas as pd
from utils.logger import get_logger

logger = get_logger(__name__)

TAXONOMY_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

LOB_TAXONOMY_FILES = {
    "auto": "auto_taxonomy.json",
    "excess_and_surplus": "es_taxonomy.json",
}

# Maps LOB key → settings attribute name for custom taxonomy path
LOB_CUSTOM_PATH_ATTRS = {
    "excess_and_surplus": "taxonomy_excess_and_surplus_path",
    "auto": "taxonomy_auto_path",
}


def load_default_taxonomy(lob: str) -> dict:
    """
    Load taxonomy for a given LOB.
    Priority:
      1. Env-configured custom path (TAXONOMY_<LOB>_PATH) — any CSV/Excel/JSON file
      2. Built-in bundled JSON in data/
    """
    from config.settings import settings  # local import avoids circular deps

    lob_key = lob.lower().replace(" ", "_")

    # 1. Check env-configured custom path
    attr = LOB_CUSTOM_PATH_ATTRS.get(lob_key)
    if attr:
        custom_path = getattr(settings, attr, "").strip()
        if custom_path and os.path.exists(custom_path):
            logger.info("taxonomy_loading_from_custom_path", lob=lob, path=custom_path)
            with open(custom_path, "rb") as f:
                file_bytes = f.read()
            taxonomy = parse_taxonomy_upload(file_bytes, os.path.basename(custom_path))
            logger.info("taxonomy_loaded_custom", lob=lob, path=custom_path, primary_count=len(taxonomy))
            return taxonomy
        elif custom_path:
            logger.warning("taxonomy_custom_path_not_found", lob=lob, path=custom_path)

    # 2. Fall back to built-in file
    filename = LOB_TAXONOMY_FILES.get(lob_key)
    if not filename:
        raise ValueError(f"No default taxonomy for LOB: {lob}")

    path = os.path.join(TAXONOMY_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Built-in taxonomy file not found: {path}")

    with open(path, "r") as f:
        taxonomy = json.load(f)

    validate_taxonomy(taxonomy)
    logger.info("taxonomy_loaded_builtin", lob=lob, primary_count=len(taxonomy))
    return taxonomy


def parse_taxonomy_upload(file_bytes: bytes, filename: str) -> dict:
    """
    Parse an uploaded taxonomy file.
    Accepts:
      - CSV  (.csv)  — columns: primary_cause, secondary_cause, tertiary_cause
      - Excel (.xlsx/.xls) — same columns
      - JSON (.json) — nested dict: {primary: {secondary: [tertiary, ...]}}
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".json":
        try:
            taxonomy = json.loads(file_bytes.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")
        validate_taxonomy(taxonomy)
        return taxonomy

    if ext == ".csv":
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        raise ValueError("Unsupported taxonomy format. Upload CSV, Excel, or JSON.")

    taxonomy = _flat_df_to_taxonomy(df, filename)
    validate_taxonomy(taxonomy)
    return taxonomy


def _flat_df_to_taxonomy(df: pd.DataFrame, filename: str) -> dict:
    """
    Convert a flat 3-column dataframe into the nested taxonomy dict.
    Expected columns (case-insensitive): primary_cause, secondary_cause, tertiary_cause
    """
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    required = {"primary_cause", "secondary_cause", "tertiary_cause"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Taxonomy file '{filename}' is missing columns: {', '.join(sorted(missing))}. "
            f"Required: primary_cause, secondary_cause, tertiary_cause"
        )

    df = df.dropna(subset=["primary_cause", "secondary_cause", "tertiary_cause"])
    df = df.astype(str).apply(lambda col: col.str.strip())
    df = df[df["primary_cause"].str.len() > 0]

    taxonomy: dict = {}
    for _, row in df.iterrows():
        p = row["primary_cause"]
        s = row["secondary_cause"]
        t = row["tertiary_cause"]
        taxonomy.setdefault(p, {}).setdefault(s, [])
        if t not in taxonomy[p][s]:
            taxonomy[p][s].append(t)

    if not taxonomy:
        raise ValueError("Taxonomy file is empty or has no valid rows.")

    logger.info(
        "flat_taxonomy_parsed",
        filename=filename,
        primary_count=len(taxonomy),
        total_rows=len(df),
    )
    return taxonomy


def validate_taxonomy(taxonomy: dict) -> None:
    """Validate taxonomy structure: {str: {str: [str]}}"""
    if not isinstance(taxonomy, dict):
        raise ValueError("Taxonomy must be a JSON object at root level")

    for primary, secondary_dict in taxonomy.items():
        if not isinstance(secondary_dict, dict):
            raise ValueError(
                f"Taxonomy error: '{primary}' must map to a dict of secondary causes"
            )
        for secondary, tertiary_list in secondary_dict.items():
            if not isinstance(tertiary_list, list):
                raise ValueError(
                    f"Taxonomy error: '{primary}.{secondary}' must map to a list of tertiary causes"
                )
            for t in tertiary_list:
                if not isinstance(t, str):
                    raise ValueError(
                        f"Taxonomy error: all tertiary causes must be strings, got {type(t)}"
                    )


def get_taxonomy_as_text(taxonomy: dict) -> str:
    """Convert taxonomy to readable text for LLM prompts."""
    lines = []
    for primary, secondary_dict in taxonomy.items():
        lines.append(f"- {primary}:")
        for secondary, tertiary_list in secondary_dict.items():
            lines.append(f"    - {secondary}:")
            for tertiary in tertiary_list:
                lines.append(f"        - {tertiary}")
    return "\n".join(lines)


def get_available_lobs() -> list[str]:
    return list(LOB_TAXONOMY_FILES.keys())
