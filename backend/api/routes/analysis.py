"""Analysis route — runs the multi-agent pipeline on uploaded claims."""
import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from api.models.request_models import RunAnalysisRequest
from api.models.response_models import AnalysisResponse, ClaimResult
from api.routes.upload import get_session
from agents.pipeline import run_pipeline
from agents.understanding_agent import run_understanding_agent
from agents.classification_agent import run_classification_agent
from agents.validation_agent import run_validation_agent
from agents.final_output_agent import run_final_output_agent
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/analysis", tags=["analysis"])

_results: dict[str, list[dict]] = {}
_jobs: dict[str, dict] = {}   # job_id → {"events": [], "done": bool}


def _fix_differs(original: dict, suggested_fix: dict | None) -> bool:
    if not suggested_fix:
        return False
    return (
        suggested_fix.get("primary_cause", "").strip().lower()
        != original.get("primary_cause", "").strip().lower()
        or suggested_fix.get("secondary_cause", "").strip().lower()
        != original.get("secondary_cause", "").strip().lower()
        or suggested_fix.get("tertiary_cause", "").strip().lower()
        != original.get("tertiary_cause", "").strip().lower()
    )


@router.post("/run", response_model=AnalysisResponse)
async def run_analysis(request: RunAnalysisRequest):
    session = get_session(request.session_id)
    claims = session["claims"]
    if not claims:
        raise HTTPException(status_code=400, detail="No claims found in session")
    if not request.taxonomy:
        raise HTTPException(status_code=400, detail="Taxonomy is required")

    results = []
    failed = 0
    for claim in claims:
        claim_id = claim["claim_id"]
        should_validate = request.run_validation and (
            request.validate_claim_ids is None
            or claim_id in (request.validate_claim_ids or [])
        )
        try:
            state = run_pipeline(
                claim_id=claim_id,
                claim_notes=claim["claim_notes"],
                claim_pdfs=claim.get("claim_pdfs", []),
                taxonomy=request.taxonomy,
                run_validation=should_validate,
            )
            if state.get("error"):
                results.append(ClaimResult(
                    claim_id=claim_id, status="error",
                    error=state["error"], completed_steps=state.get("completed_steps", []),
                ))
                failed += 1
            else:
                results.append(ClaimResult(
                    claim_id=claim_id, status="success",
                    understanding_output=state.get("understanding_output"),
                    classification_output=state.get("classification_output"),
                    validation_output=state.get("validation_output"),
                    final_output=state.get("final_output"),
                    completed_steps=state.get("completed_steps", []),
                ))
        except Exception as e:
            results.append(ClaimResult(claim_id=claim_id, status="error", error=str(e)))
            failed += 1

    _results[request.session_id] = [r.model_dump() for r in results]
    return AnalysisResponse(
        session_id=request.session_id, total_claims=len(claims),
        processed=len(claims) - failed, failed=failed, results=results,
    )


@router.get("/results/{session_id}")
async def get_results(session_id: str):
    results = _results.get(session_id)
    if results is None:
        raise HTTPException(status_code=404, detail="No results found for this session")
    return {"session_id": session_id, "results": results}


# ── Background job + polling (Azure-compatible) ───────────────────────────────

async def _run_job(
    job_id: str,
    session_id: str,
    claims: list,
    taxonomy: dict,
    run_validation: bool,
    validate_claim_ids: list | None,
    claim_ids: list | None,
) -> None:
    def push(event: dict) -> None:
        _jobs[job_id]["events"].append(event)

    try:
        claims_to_run = (
            [c for c in claims if c["claim_id"] in claim_ids]
            if claim_ids else claims
        )

        for i, claim in enumerate(claims_to_run):
            claim_id    = claim["claim_id"]
            claim_notes = claim["claim_notes"]
            claim_pdfs  = claim.get("claim_pdfs", [])
            should_validate = run_validation and (
                validate_claim_ids is None or claim_id in (validate_claim_ids or [])
            )

            push({"type": "claim_start", "claim_id": claim_id, "index": i, "total": len(claims_to_run)})

            state = {
                "understanding_output": {},
                "classification_output": {},
                "corrected_classification_output": None,
                "validation_output": None,
                "final_output": {},
                "completed_steps": [],
                "error": None,
            }

            try:
                # ── Understanding ────────────────────────────────────────────
                push({"type": "agent_start", "claim_id": claim_id, "agent": "understanding"})
                understanding = await asyncio.to_thread(
                    run_understanding_agent, claim_id, claim_notes, claim_pdfs
                )
                state["understanding_output"] = understanding
                state["completed_steps"].append("understanding")
                push({"type": "agent_complete", "claim_id": claim_id, "agent": "understanding", "output": understanding})

                # ── Classification ───────────────────────────────────────────
                push({"type": "agent_start", "claim_id": claim_id, "agent": "classification"})
                classification = await asyncio.to_thread(
                    run_classification_agent,
                    claim_notes,
                    understanding,
                    taxonomy,
                    understanding.get("pdf_raw_extractions"),
                )
                state["classification_output"] = classification
                state["completed_steps"].append("classification")
                push({"type": "agent_complete", "claim_id": claim_id, "agent": "classification", "output": classification})

                # ── Validation (optional) ────────────────────────────────────
                if should_validate:
                    push({"type": "agent_start", "claim_id": claim_id, "agent": "validation"})
                    validation = await asyncio.to_thread(
                        run_validation_agent, claim_notes, understanding, classification, taxonomy
                    )
                    fix_is_different = _fix_differs(classification, validation.get("suggested_fix"))
                    if not fix_is_different:
                        validation["is_valid"] = True
                        validation["suggested_fix"] = None

                    state["validation_output"] = validation
                    state["completed_steps"].append("validation")
                    push({"type": "agent_complete", "claim_id": claim_id, "agent": "validation", "output": validation})

                    if not validation.get("is_valid", True) and fix_is_different:
                        push({"type": "agent_start", "claim_id": claim_id, "agent": "classification_retry"})
                        fix = validation.get("suggested_fix", {})
                        orig_conf = state["classification_output"].get("confidence", {})
                        _p = float(fix.get("primary_confidence", orig_conf.get("primary", 0.0)))
                        _s = float(fix.get("secondary_confidence", orig_conf.get("secondary", 0.0)))
                        _t = float(fix.get("tertiary_confidence", orig_conf.get("tertiary", 0.0)))
                        _overall = round((_p + _s + _t) / 3, 4)
                        corrected = {
                            **state["classification_output"],
                            "primary_cause": fix.get("primary_cause", classification.get("primary_cause", "")),
                            "secondary_cause": fix.get("secondary_cause", classification.get("secondary_cause", "")),
                            "tertiary_cause": fix.get("tertiary_cause", classification.get("tertiary_cause", "")),
                            "confidence": {
                                "primary": _p,
                                "primary_reasoning": fix.get("primary_confidence_reasoning") or orig_conf.get("primary_reasoning", ""),
                                "secondary": _s,
                                "secondary_reasoning": fix.get("secondary_confidence_reasoning") or orig_conf.get("secondary_reasoning", ""),
                                "tertiary": _t,
                                "tertiary_reasoning": fix.get("tertiary_confidence_reasoning") or orig_conf.get("tertiary_reasoning", ""),
                                "overall": _overall,
                            },
                            "classification_grade": "HIGH" if _overall > 0.80 else "MEDIUM" if _overall > 0.60 else "LOW",
                            "reasoning": fix.get("correction_reasoning") or validation.get("audit_notes", "Corrected by validation agent."),
                        }
                        state["corrected_classification_output"] = corrected
                        state["completed_steps"].append("classification_retry")
                        push({"type": "agent_complete", "claim_id": claim_id, "agent": "classification_retry", "output": corrected})

                # ── Final Output ─────────────────────────────────────────────
                effective_classification = state["corrected_classification_output"] or state["classification_output"]
                push({"type": "agent_start", "claim_id": claim_id, "agent": "final_output"})
                final = await asyncio.to_thread(
                    run_final_output_agent,
                    understanding, effective_classification, state["validation_output"]
                )
                state["final_output"] = final
                state["completed_steps"].append("final_output")
                push({"type": "agent_complete", "claim_id": claim_id, "agent": "final_output", "output": final})

            except Exception as e:
                logger.error("job_agent_error", claim_id=claim_id, error=str(e))
                state["error"] = str(e)
                push({"type": "agent_error", "claim_id": claim_id, "error": str(e)})

            result = {
                "type": "claim_complete",
                "claim_id": claim_id, "index": i,
                "claim_notes": claim_notes,
                "status": "error" if state["error"] else "success",
                "error": state["error"],
                "completed_steps": state["completed_steps"],
                "understanding_output": state["understanding_output"],
                "classification_output": state["classification_output"],
                "corrected_classification_output": state["corrected_classification_output"],
                "validation_output": state["validation_output"],
                "final_output": state["final_output"],
            }
            push(result)

        push({"type": "pipeline_complete", "total": len(claims_to_run)})
        _results[session_id] = [
            e for e in _jobs[job_id]["events"] if e.get("type") == "claim_complete"
        ]

    except Exception as e:
        logger.error("job_error", job_id=job_id, error=str(e))
        push({"type": "pipeline_error", "error": str(e)})
    finally:
        _jobs[job_id]["done"] = True


@router.post("/run/async")
async def run_analysis_async(request: RunAnalysisRequest):
    """Start a background pipeline job and return a job_id to poll."""
    session = get_session(request.session_id)
    claims = session["claims"]
    if not claims:
        raise HTTPException(status_code=400, detail="No claims found in session")
    if not request.taxonomy:
        raise HTTPException(status_code=400, detail="Taxonomy is required")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"events": [], "done": False}

    # create_task schedules the coroutine in the running event loop immediately.
    # Store the task reference so the garbage collector doesn't kill it mid-run.
    task = asyncio.create_task(_run_job(
        job_id=job_id,
        session_id=request.session_id,
        claims=list(claims),   # snapshot — avoids any session-mutation races
        taxonomy=request.taxonomy,
        run_validation=request.run_validation,
        validate_claim_ids=request.validate_claim_ids,
        claim_ids=request.claim_ids,
    ))
    _jobs[job_id]["task"] = task

    return {"job_id": job_id}


@router.get("/run/poll/{job_id}")
async def poll_job(job_id: str, since: int = 0):
    """Return new events since `since` cursor and whether the job is done."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    new_events = job["events"][since:]
    return JSONResponse(
        content={
            "events": new_events,
            "cursor": since + len(new_events),
            "done": job["done"],
        },
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )


# ── SSE streaming (kept for local dev / fallback) ─────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _with_pings(task: asyncio.Task, interval: int = 20):
    while not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=interval)
        except asyncio.TimeoutError:
            yield ": heartbeat\n\n"


@router.post("/run/stream")
async def run_analysis_stream(request: RunAnalysisRequest):
    """SSE — emits per-agent events for real-time UI updates."""
    session = get_session(request.session_id)
    claims = session["claims"]

    async def generate():
        all_results = []

        claims_to_run = (
            [c for c in claims if c["claim_id"] in request.claim_ids]
            if request.claim_ids else claims
        )

        for i, claim in enumerate(claims_to_run):
            claim_id    = claim["claim_id"]
            claim_notes = claim["claim_notes"]
            claim_pdfs  = claim.get("claim_pdfs", [])
            should_validate = request.run_validation and (
                request.validate_claim_ids is None
                or claim_id in (request.validate_claim_ids or [])
            )

            yield _sse({"type": "claim_start", "claim_id": claim_id, "index": i, "total": len(claims_to_run)})
            await asyncio.sleep(0)

            state = {
                "understanding_output": {},
                "classification_output": {},
                "corrected_classification_output": None,
                "validation_output": None,
                "final_output": {},
                "completed_steps": [],
                "error": None,
            }

            try:
                # ── Understanding ────────────────────────────────────────────
                yield _sse({"type": "agent_start", "claim_id": claim_id, "agent": "understanding"})
                await asyncio.sleep(0)
                task = asyncio.create_task(asyncio.to_thread(
                    run_understanding_agent, claim_id, claim_notes, claim_pdfs
                ))
                async for ping in _with_pings(task):
                    yield ping
                understanding = task.result()
                state["understanding_output"] = understanding
                state["completed_steps"].append("understanding")
                yield _sse({"type": "agent_complete", "claim_id": claim_id, "agent": "understanding", "output": understanding})
                await asyncio.sleep(0)

                # ── Classification ───────────────────────────────────────────
                yield _sse({"type": "agent_start", "claim_id": claim_id, "agent": "classification"})
                await asyncio.sleep(0)
                task = asyncio.create_task(asyncio.to_thread(
                    run_classification_agent,
                    claim_notes,
                    understanding,
                    request.taxonomy,
                    understanding.get("pdf_raw_extractions"),
                ))
                async for ping in _with_pings(task):
                    yield ping
                classification = task.result()
                state["classification_output"] = classification
                state["completed_steps"].append("classification")
                yield _sse({"type": "agent_complete", "claim_id": claim_id, "agent": "classification", "output": classification})
                await asyncio.sleep(0)

                # ── Validation (optional) ────────────────────────────────────
                if should_validate:
                    yield _sse({"type": "agent_start", "claim_id": claim_id, "agent": "validation"})
                    await asyncio.sleep(0)
                    task = asyncio.create_task(asyncio.to_thread(
                        run_validation_agent, claim_notes, understanding, classification, request.taxonomy
                    ))
                    async for ping in _with_pings(task):
                        yield ping
                    validation = task.result()

                    fix_is_different = _fix_differs(classification, validation.get("suggested_fix"))
                    if not fix_is_different:
                        validation["is_valid"] = True
                        validation["suggested_fix"] = None

                    state["validation_output"] = validation
                    state["completed_steps"].append("validation")
                    yield _sse({"type": "agent_complete", "claim_id": claim_id, "agent": "validation", "output": validation})
                    await asyncio.sleep(0)

                    if not validation.get("is_valid", True) and fix_is_different:
                        yield _sse({"type": "agent_start", "claim_id": claim_id, "agent": "classification_retry"})
                        await asyncio.sleep(0)
                        fix = validation.get("suggested_fix", {})
                        orig_conf = state["classification_output"].get("confidence", {})
                        _p = float(fix.get("primary_confidence", orig_conf.get("primary", 0.0)))
                        _s = float(fix.get("secondary_confidence", orig_conf.get("secondary", 0.0)))
                        _t = float(fix.get("tertiary_confidence", orig_conf.get("tertiary", 0.0)))
                        _overall = round((_p + _s + _t) / 3, 4)
                        corrected = {
                            **state["classification_output"],
                            "primary_cause": fix.get("primary_cause", classification.get("primary_cause", "")),
                            "secondary_cause": fix.get("secondary_cause", classification.get("secondary_cause", "")),
                            "tertiary_cause": fix.get("tertiary_cause", classification.get("tertiary_cause", "")),
                            "confidence": {
                                "primary": _p,
                                "primary_reasoning": fix.get("primary_confidence_reasoning") or orig_conf.get("primary_reasoning", ""),
                                "secondary": _s,
                                "secondary_reasoning": fix.get("secondary_confidence_reasoning") or orig_conf.get("secondary_reasoning", ""),
                                "tertiary": _t,
                                "tertiary_reasoning": fix.get("tertiary_confidence_reasoning") or orig_conf.get("tertiary_reasoning", ""),
                                "overall": _overall,
                            },
                            "classification_grade": "HIGH" if _overall > 0.80 else "MEDIUM" if _overall > 0.60 else "LOW",
                            "reasoning": fix.get("correction_reasoning") or validation.get("audit_notes", "Corrected by validation agent."),
                        }
                        state["corrected_classification_output"] = corrected
                        state["completed_steps"].append("classification_retry")
                        yield _sse({"type": "agent_complete", "claim_id": claim_id, "agent": "classification_retry", "output": corrected})
                        await asyncio.sleep(0)

                # ── Final Output ─────────────────────────────────────────────
                effective_classification = state["corrected_classification_output"] or state["classification_output"]
                yield _sse({"type": "agent_start", "claim_id": claim_id, "agent": "final_output"})
                await asyncio.sleep(0)
                task = asyncio.create_task(asyncio.to_thread(
                    run_final_output_agent,
                    understanding, effective_classification, state["validation_output"]
                ))
                async for ping in _with_pings(task):
                    yield ping
                final = task.result()
                state["final_output"] = final
                state["completed_steps"].append("final_output")
                yield _sse({"type": "agent_complete", "claim_id": claim_id, "agent": "final_output", "output": final})
                await asyncio.sleep(0)

            except Exception as e:
                logger.error("stream_agent_error", claim_id=claim_id, error=str(e))
                state["error"] = str(e)
                yield _sse({"type": "agent_error", "claim_id": claim_id, "error": str(e)})
                await asyncio.sleep(0)

            result = {
                "type": "claim_complete",
                "claim_id": claim_id, "index": i,
                "claim_notes": claim_notes,
                "status": "error" if state["error"] else "success",
                "error": state["error"],
                "completed_steps": state["completed_steps"],
                "understanding_output": state["understanding_output"],
                "classification_output": state["classification_output"],
                "corrected_classification_output": state["corrected_classification_output"],
                "validation_output": state["validation_output"],
                "final_output": state["final_output"],
            }
            all_results.append(result)
            yield _sse(result)
            await asyncio.sleep(0)

        _results[request.session_id] = all_results
        yield _sse({"type": "pipeline_complete", "total": len(claims_to_run)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked",
        },
    )
