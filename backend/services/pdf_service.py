"""PDF extraction service using pdfplumber (primary) with PyPDF2 fallback."""
import os
from typing import Optional
import pdfplumber
import PyPDF2
from utils.logger import get_logger

logger = get_logger(__name__)


def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
    """Extract text from a single PDF file. Returns None if file not found."""
    if not os.path.exists(pdf_path):
        logger.warning("pdf_not_found", path=pdf_path)
        return None

    try:
        return _extract_with_pdfplumber(pdf_path)
    except Exception as e:
        logger.warning("pdfplumber_failed", path=pdf_path, error=str(e))
        try:
            return _extract_with_pypdf2(pdf_path)
        except Exception as e2:
            logger.error("pdf_extraction_failed", path=pdf_path, error=str(e2))
            return None


def extract_text_from_pdfs(pdf_paths: list[str]) -> dict[str, str]:
    """Extract text from multiple PDFs. Returns {path: text} mapping."""
    results = {}
    for path in pdf_paths:
        text = extract_text_from_pdf(path.strip())
        if text:
            results[path] = text
    return results


def _extract_with_pdfplumber(path: str) -> str:
    texts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
    return "\n\n".join(texts)


def _extract_with_pypdf2(path: str) -> str:
    texts = []
    with open(path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
    return "\n\n".join(texts)
