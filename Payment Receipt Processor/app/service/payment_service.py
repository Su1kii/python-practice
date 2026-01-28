import logging
import random
import time
import uuid
from datetime import datetime, timezone

import httpx

from app.models.payment import Payment, PaymentCreateRequest
from app.models.status import PaymentStatus
from app.storage.in_memory import (
    get_payment,
    get_payment_by_idempotency_key,
    save_idempotency_key,
    save_payment,
)

logger = logging.getLogger(__name__)

WEBHOOK_URL = "http://127.0.0.1:8000/webhooks/payment-event"
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = [1, 2, 4]


def create_payment(
    req: PaymentCreateRequest, idempotency_key: str | None = None
) -> Payment:
    # Idempotency: if same key seen before, return the original payment
    if idempotency_key:
        existing_payment_id = get_payment_by_idempotency_key(idempotency_key)
        if existing_payment_id:
            existing = get_payment(existing_payment_id)
            if existing:
                return existing

    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    payment = Payment(
        payment_id=payment_id,
        status=PaymentStatus.PENDING,
        amount=req.amount,
        currency=req.currency.upper(),
        customer_id=req.customer_id,
        created_at=now,
        updated_at=now,
    )

    save_payment(payment)

    if idempotency_key:
        save_idempotency_key(idempotency_key, payment_id)

    return payment


def process_payment(payment_id: str) -> Payment | None:
    payment = get_payment(payment_id)
    if not payment:
        return None

    # Move to PROCESSING
    processing = payment.model_copy(
        update={
            "status": PaymentStatus.PROCESSING,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    save_payment(processing)

    # Simulate work (e.g., talking to a provider)
    time.sleep(2)

    # Random success/failure
    if random.random() < 0.2:
        final = processing.model_copy(
            update={
                "status": PaymentStatus.FAILED,
                "error": "Provider declined or transient internal error.",
                "updated_at": datetime.now(timezone.utc),
            }
        )
        save_payment(final)
        send_payment_webhook(final, event_type="payment.failed")
        return final

    final = processing.model_copy(
        update={
            "status": PaymentStatus.SUCCEEDED,
            "error": None,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    save_payment(final)
    send_payment_webhook(final, event_type="payment.succeeded")
    return final


def send_payment_webhook(payment: Payment, event_type: str) -> bool:
    event_id = str(uuid.uuid4())
    payload = {
        "event_id": event_id,
        "payment_id": payment.payment_id,
        "type": event_type,
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
