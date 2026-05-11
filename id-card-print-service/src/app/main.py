import logging
import os
import threading
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, SessionLocal
from .models import Base
from .routes import router, cards, employees, admin, notifications
from .routes.admin import seed_admin
from .storage import ensure_dirs
from .cron_jobs import start_scheduler

app = FastAPI(title="ID Card Print Service (Local)")
logger = logging.getLogger(__name__)
_reminder_stop_event: threading.Event | None = None
_reminder_thread: threading.Thread | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-PDF-Email-Status", "X-PDF-Email-To", "X-PDF-Email-Error"],
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

    _start_daily_reminder_worker()
    start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    _stop_daily_reminder_worker()


def _seconds_until_next_run(hour: int, minute: int) -> float:
    now = datetime.now()
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run <= now:
        next_run = next_run + timedelta(days=1)
    return max((next_run - now).total_seconds(), 1.0)


def _daily_reminder_loop(stop_event: threading.Event, hour: int, minute: int):
    while not stop_event.is_set():
        sleep_for = _seconds_until_next_run(hour, minute)
        if stop_event.wait(timeout=sleep_for):
            break
        db = SessionLocal()
        try:
            stats = employees.send_daily_bookmark_reminders(db)
            logger.info("Daily reminder job completed: %s", stats)
        except Exception:
            logger.exception("Daily reminder job failed")
        finally:
            db.close()


def _start_daily_reminder_worker():
    global _reminder_stop_event, _reminder_thread
    if _reminder_thread and _reminder_thread.is_alive():
        return

    hour = int((os.getenv("DAILY_REMINDER_HOUR", "9") or "9").strip())
    minute = int((os.getenv("DAILY_REMINDER_MINUTE", "0") or "0").strip())
    _reminder_stop_event = threading.Event()
    _reminder_thread = threading.Thread(
        target=_daily_reminder_loop,
        args=(_reminder_stop_event, hour, minute),
        daemon=True,
        name="daily-bookmark-reminder",
    )
    _reminder_thread.start()
    logger.info("Daily reminder worker started at %02d:%02d", hour, minute)


def _stop_daily_reminder_worker():
    global _reminder_stop_event, _reminder_thread
    if _reminder_stop_event:
        _reminder_stop_event.set()
    if _reminder_thread and _reminder_thread.is_alive():
        _reminder_thread.join(timeout=2.0)
    _reminder_stop_event = None
    _reminder_thread = None

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

app.include_router(router)
app.include_router(employees.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
