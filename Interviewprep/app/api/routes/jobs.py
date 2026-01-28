from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from app.models.job import JobCreateRequest
from app.services.job_service import create_job, process_job
from app.storage.in_memory import get_job

router = APIRouter()


@router.post("/jobs")
def create_job_route(
    job_request: JobCreateRequest,
    background_tasks: BackgroundTasks,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    job = create_job(job_request, idempotency_key=idempotency_key)

    # IMPORTANT: run processing in the background so the request returns immediately
    background_tasks.add_task(process_job, job.job_id)

    return job


@router.get("/jobs/{job_id}")
def get_job_route(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
