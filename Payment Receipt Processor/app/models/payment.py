from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.status import PaymentStatus


class PaymentCreateRequest(BaseModel):
    amount: int = Field(..., gt=0)  # cents
    currency: str = Field(..., min_length=3, max_length=3)  # "USD"
    customer_id: str = Field(..., min_length=1)


class Payment(BaseModel):
    payment_id: str
    status: PaymentStatus
    amount: int
    currency: str
    customer_id: str
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
