"""
LLM Service — single point of contact for all Azure OpenAI calls.
Swap keys or endpoints here without touching agent code.
"""
import json
import re
from typing import Optional
from openai import AzureOpenAI
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_client: Optional[AzureOpenAI] = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=settings.azure_openai_api_key,
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )
    return _client


def call_llm(prompt: str, system_prompt: str, temperature: float = 0.1) -> dict:
    """
    Core LLM call. Returns parsed JSON dict.
    All agents call this function exclusively.
    """
    client = _get_client()
    logger.debug(
        "llm_call_start",
        endpoint=settings.azure_openai_endpoint,
        deployment=settings.azure_openai_deployment_name,
        prompt_length=len(prompt),
    )

    try:
        response = client.chat.completions.create(
            model=settings.azure_openai_deployment_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=16384,
        )
    except Exception as e:
        logger.error(
            "llm_call_failed",
            error=str(e),
            endpoint=settings.azure_openai_endpoint,
            deployment=settings.azure_openai_deployment_name,
            key_set=bool(settings.azure_openai_api_key),
        )
        raise

    raw = response.choices[0].message.content
    logger.debug("llm_call_complete", response_length=len(raw))

    return _parse_json_safe(raw)


def call_llm_text(prompt: str, system_prompt: str, temperature: float = 0.1) -> str:
    """Returns raw text response (for non-JSON use cases)."""
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.azure_openai_deployment_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        max_completion_tokens=16384,
    )
    return response.choices[0].message.content


def _parse_json_safe(raw: str) -> dict:
    """Robust JSON parser that handles markdown code fences."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error("json_parse_failed", raw=raw[:500], error=str(e))
            raise ValueError(f"LLM returned invalid JSON: {e}") from e
