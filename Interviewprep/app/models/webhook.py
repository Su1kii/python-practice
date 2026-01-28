from typing import Optional

from pydantic import BaseModel

from app.models.status_enum import Status


class JobCompleteWebhook(BaseModel):
    event_id: str
    job_id: str
    status: Status
    result: Optional[str] = None
    error: Optional[str] = None
