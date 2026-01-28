from typing import Dict, Set

from app.models.job import Job

jobs: Dict[str, Job] = {}
idempotency_keys: Dict[str, str] = {}
processed_events: Set[str] = set()


def get_job(job_id: str):
    return jobs.get(job_id)


def save_job(job):
    jobs[job.job_id] = job


def job_exists(job_id: str) -> bool:
    return job_id in jobs


def get_job_by_idempotency_key(key: str):
    return idempotency_keys.get(key)


def save_idempotency_key(key: str, job_id: str):
    idempotency_keys[key] = job_id


def is_event_processed(event_id: str) -> bool:
    return event_id in processed_events


def mark_event_processed(event_id: str):
    processed_events.add(event_id)
