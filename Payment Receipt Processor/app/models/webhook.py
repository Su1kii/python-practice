from typing import Literal

from pydantic import BaseModel, Field


class PaymentEventWebhook(BaseModel):
    event_id: str = Field(..., min_length=1)
    payment_id: str = Field(..., min_length=1)
    type: Literal["payment.succeeded", "payment.failed"]
