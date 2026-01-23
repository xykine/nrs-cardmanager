from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine
from .models import Base
from .routes import router, cards, employees
from .storage import ensure_dirs

app = FastAPI(title="ID Card Print Service (Local)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    ensure_dirs()
    Base.metadata.create_all(bind=engine)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

app.include_router(router)
app.include_router(employees.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
