"""PII removal — strips common personal identifiers before text is sent to any LLM."""
import re

# Each entry: (compiled_pattern, replacement_token)
_RULES: list[tuple[re.Pattern, str]] = [
    # Email addresses
    (re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'), '[EMAIL]'),

    # US phone numbers — (555) 123-4567 / 555-123-4567 / +1 555 123 4567
    (re.compile(r'\b(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]\d{4}\b'), '[PHONE]'),

    # Social Security Number
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN]'),

    # Date of birth — explicit label (DOB: 1968-03-12) or (DOB: 03/12/1968)
    (re.compile(
        r'\(?\s*(?:DOB|Date\s+of\s+Birth|D\.O\.B\.?)\s*:?\s*'
        r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*\)?',
        re.IGNORECASE,
    ), '(DOB: [REDACTED])'),
    (re.compile(
        r'\(?\s*(?:DOB|Date\s+of\s+Birth|D\.O\.B\.?)\s*:?\s*'
        r'\d{4}[\/\-]\d{2}[\/\-]\d{2}\s*\)?',
        re.IGNORECASE,
    ), '(DOB: [REDACTED])'),

    # Person names preceded by honorifics
    (re.compile(
        r'\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Miss|Prof\.)\s+'
        r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b',
    ), '[PERSON]'),

    # Credit / debit card numbers (16-digit with optional separators)
    (re.compile(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b'), '[CARD_NUMBER]'),

    # IPv4 addresses
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'), '[IP_ADDRESS]'),

    # Bitcoin / crypto wallet addresses (Base58, 26-35 chars)
    (re.compile(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b'), '[CRYPTO_ADDRESS]'),
]


def remove_pii(text: str) -> str:
    """Return a copy of *text* with recognised PII tokens replaced."""
    if not text:
        return text
    for pattern, token in _RULES:
        text = pattern.sub(token, text)
    return text
