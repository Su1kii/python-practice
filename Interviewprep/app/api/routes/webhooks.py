from fastapi import APIRouter

from app.models.webhook import JobCompleteWebhook
from app.storage.in_memory import is_event_processed, mark_event_processed

router = APIRouter()


@router.post("/webhooks/job-complete")
async def job_complete_webhook(webhook: JobCompleteWebhook):
    # Dedupe by event_id (idempotent webhook handler)
    if is_event_processed(webhook.event_id):
        return {"ok": True, "duplicate": True}

    mark_event_processed(webhook.event_id)

    # (Optional later) Update the job in storage based on webhook payload
    # For now, we just acknowledge receipt.
    return {"ok": True, "duplicate": False}
