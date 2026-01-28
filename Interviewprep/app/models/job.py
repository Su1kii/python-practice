# app/models/job.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.status_enum import Status


class JobCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class Job(BaseModel):
    job_id: str
    status: Status
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
