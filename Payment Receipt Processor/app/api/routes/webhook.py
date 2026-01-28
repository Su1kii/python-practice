from fastapi import APIRouter

from app.models.webhook import PaymentEventWebhook
from app.storage.in_memory import is_event_processed, mark_event_processed

router = APIRouter()


@router.post("/webhooks/payment-event")
async def payment_event_webhook(event: PaymentEventWebhook):
    # Idempotent webhook receiver
    if is_event_processed(event.event_id):
        return {"ok": True, "duplicate": True}

    mark_event_processed(event.event_id)

    # In real systems, you'd update DB / trigger downstream actions here.
    return {"ok": True, "duplicate": False}
