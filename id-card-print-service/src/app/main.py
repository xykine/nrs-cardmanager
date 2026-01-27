from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, SessionLocal
from .models import Base
from .routes import router, cards, employees, admin
from .routes.admin import seed_admin
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
    
    # Seed admin user
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

app.include_router(router)
app.include_router(employees.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
