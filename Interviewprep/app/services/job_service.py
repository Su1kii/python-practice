import logging
import random
import time
import uuid
from datetime import datetime, timezone

import httpx

from app.models.job import Job, JobCreateRequest
from app.models.status_enum import Status
from app.storage.in_memory import (
    get_job,
    get_job_by_idempotency_key,
    save_idempotency_key,
    save_job,
)

WEBHOOK_URL = "http://127.0.0.1:8000/webhooks/job-complete"
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = [1, 2, 4]
logger = logging.getLogger(__name__)


def create_job(job_request: JobCreateRequest, idempotency_key: str | None = None):
    if idempotency_key:
        existing_job_id = get_job_by_idempotency_key(idempotency_key)
        if existing_job_id:
            existing_job = get_job(existing_job_id)
            if existing_job:
                return existing_job

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    job = Job(
        job_id=job_id,
        status=Status.QUEUED,
        created_at=now,
        updated_at=now,
    )

    save_job(job)

    if idempotency_key:
        save_idempotency_key(idempotency_key, job_id)

    return job


def send_job_complete_webhook(job: Job):
    event_id = str(uuid.uuid4())
    payload = {
        "event_id": event_id,
        "job_id": job.job_id,
        "status": job.status.value,
        "result": job.result,
        "error": job.error,
    }

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(WEBHOOK_URL, json=payload)

            if 200 <= resp.status_code < 300:
                logger.info(
                    "Webhook delivered",
                    extra={"event_id": event_id, "attempt": attempt},
                )
                return True

            logger.warning(
                "Webhook non-2xx response",
                extra={
                    "event_id": event_id,
                    "attempt": attempt,
                    "status_code": resp.status_code,
                },
            )

        except Exception as e:
            logger.warning(
                "Webhook delivery failed",
                extra={"event_id": event_id, "attempt": attempt, "error": str(e)},
            )

        if attempt < MAX_ATTEMPTS:
            time.sleep(BACKOFF_SECONDS[attempt - 1])

    logger.error("Webhook delivery exhausted retries", extra={"event_id": event_id})
    return False


def process_job(job_id: str):
    job = get_job(job_id)
    if not job:
        return None

    updated_job = job.model_copy(
        update={"status": Status.PROCESSING, "updated_at": datetime.now(timezone.utc)}
    )
    save_job(updated_job)

    time.sleep(2)

    if random.random() < 0.2:
        final_job = updated_job.model_copy(
            update={
                "status": Status.FAILED,
                "error": "Processing failed due to an internal error.",
                "updated_at": datetime.now(timezone.utc),
            }
        )
    else:
        final_job = updated_job.model_copy(
            update={
                "status": Status.COMPLETED,
                "result": f"Processed result for job {job_id}",
                "error": None,
                "updated_at": datetime.now(timezone.utc),
            }
        )

    save_job(final_job)
    send_job_complete_webhook(final_job)
    return final_job
