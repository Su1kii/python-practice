from fastapi import FastAPI

from app.api.routes.payment import router as payments_router
from app.api.routes.webhook import router as webhooks_router

app = FastAPI(title="Payment Receipt Processor")

app.include_router(payments_router)
app.include_router(webhooks_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
