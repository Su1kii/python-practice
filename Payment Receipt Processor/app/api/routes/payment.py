from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from app.models.payment import PaymentCreateRequest
from app.service.payment_service import create_payment, process_payment
from app.storage.in_memory import get_payment

router = APIRouter()


@router.post("/payments")
def create_payment_route(
    req: PaymentCreateRequest,
    background_tasks: BackgroundTasks,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    payment = create_payment(req, idempotency_key=idempotency_key)

    # Kick off background processing (returns immediately)
    background_tasks.add_task(process_payment, payment.payment_id)

    return payment


@router.get("/payments/{payment_id}")
def get_payment_route(payment_id: str):
    payment = get_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment
