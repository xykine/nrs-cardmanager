-- Migration script to add missing columns to the employees table in PostgreSQL
-- You can run this inside your docker container using:
-- psql -U <username> -d <dbname> -f migration_missing_employee_columns.sql

ALTER TABLE employees ADD COLUMN IF NOT EXISTS position VARCHAR;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS consultant_prefix VARCHAR;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_end_date DATE;
