"""
In-memory learning store for dynamic prompt rules.
In production, replace with a database-backed store (PostgreSQL, Redis, etc.).
"""
import json
import os
from typing import Optional
from datetime import datetime
from utils.logger import get_logger

logger = get_logger(__name__)

STORE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "learning_store.json")

_store: dict = {
    "rules": [],
    "corrections": [],
}


def _load_store():
    global _store
    if os.path.exists(STORE_PATH):
        try:
            with open(STORE_PATH, "r") as f:
                _store = json.load(f)
        except Exception:
            _store = {"rules": [], "corrections": []}


def _save_store():
    os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
    with open(STORE_PATH, "w") as f:
        json.dump(_store, f, indent=2)


_load_store()


def add_rule(rule: dict) -> None:
    """Add a learned classification rule."""
    rule["created_at"] = datetime.utcnow().isoformat()
    _store["rules"].append(rule)
    _save_store()
    logger.info("rule_added", rule_text=rule.get("extracted_rule", "")[:100])


def get_active_rules() -> list[dict]:
    """Return all active rules for injection into prompts."""
    return [r for r in _store["rules"] if r.get("active", True)]


def get_rules_as_text() -> str:
    """Format rules for injection into LLM prompts."""
    rules = get_active_rules()
    if not rules:
        return ""
    lines = ["LEARNED CLASSIFICATION RULES (apply these strictly):"]
    for i, rule in enumerate(rules, 1):
        lines.append(f"{i}. {rule['extracted_rule']}")
    return "\n".join(lines)


def add_correction(correction: dict) -> None:
    """Store a manual user correction."""
    correction["created_at"] = datetime.utcnow().isoformat()
    _store["corrections"].append(correction)
    _save_store()
    logger.info("correction_stored", claim_id=correction.get("claim_id"))


def get_all_corrections() -> list[dict]:
    return _store["corrections"]


def deactivate_rule(rule_index: int) -> bool:
    """Soft-delete a rule by index."""
    if 0 <= rule_index < len(_store["rules"]):
        _store["rules"][rule_index]["active"] = False
        _save_store()
        return True
    return False
