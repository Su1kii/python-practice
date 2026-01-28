from fastapi import FastAPI

from app.api.routes import jobs, webhooks

app = FastAPI(title="Zom Mini Backend")
app.include_router(webhooks.router)
app.include_router(jobs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
