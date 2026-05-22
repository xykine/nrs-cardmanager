-- Add pdfUrl to print_reports (colleague batch-PDF feature)
-- SQLite (local):
--   sqlite3 print.db < migration_print_report_pdf_url.sql
-- PostgreSQL:
--   ALTER TABLE print_reports ADD COLUMN IF NOT EXISTS "pdfUrl" VARCHAR;

ALTER TABLE print_reports ADD COLUMN "pdfUrl" VARCHAR;
