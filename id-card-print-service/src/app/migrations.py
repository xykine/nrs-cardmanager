"""Lightweight schema patches for existing databases (no Alembic)."""

from sqlalchemy import inspect, text

from .db import engine


def apply_pending_migrations() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "print_reports" in table_names:
        columns = {col["name"] for col in inspector.get_columns("print_reports")}
        if "pdfUrl" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text('ALTER TABLE print_reports ADD COLUMN "pdfUrl" VARCHAR')
                )
