from typing import Dict, Optional, Set

from app.models.payment import Payment

payments: Dict[str, Payment] = {}
idempotency_keys: Dict[str, str] = {}  # key -> payment_id
processed_events: Set[str] = set()  # webhook event_id dedupe


def get_payment(payment_id: str) -> Optional[Payment]:
    return payments.get(payment_id)


def save_payment(payment: Payment) -> None:
    payments[payment.payment_id] = payment


def get_payment_by_idempotency_key(key: str) -> Optional[str]:
    return idempotency_keys.get(key)


def save_idempotency_key(key: str, payment_id: str) -> None:
    idempotency_keys[key] = payment_id


def is_event_processed(event_id: str) -> bool:
    return event_id in processed_events


def mark_event_processed(event_id: str) -> None:
    processed_events.add(event_id)
