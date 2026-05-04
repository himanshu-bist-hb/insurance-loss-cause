"""
Loss Cause Agent — FastAPI application entry point.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import settings
from utils.logger import configure_logging, get_logger
from api.routes import upload, analysis, taxonomy, feedback

configure_logging()
logger = get_logger(__name__)

os.makedirs(settings.upload_dir, exist_ok=True)

# ── Startup config check ────────────────────────────────────────────────────
_key = settings.azure_openai_api_key
_endpoint = settings.azure_openai_endpoint
if not _key or not _endpoint:
    logger.warning(
        "azure_config_missing",
        hint="No .env file found or AZURE_OPENAI_API_KEY/ENDPOINT are empty. "
             "Copy .env.example to .env and fill in your credentials.",
        key_set=bool(_key),
        endpoint_set=bool(_endpoint),
    )
else:
    logger.info(
        "azure_config_loaded",
        endpoint=_endpoint,
        deployment=settings.azure_openai_deployment_name,
        api_version=settings.azure_openai_api_version,
        key_prefix=_key[:8] + "...",
    )

app = FastAPI(
    title="Loss Cause Agent API",
    description="Multi-agent AI system for insurance loss cause classification",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(taxonomy.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "env": settings.app_env}


@app.get("/")
async def root():
    return {
        "name": "Loss Cause Agent API",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
