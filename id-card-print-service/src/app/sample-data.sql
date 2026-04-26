-- Sample data for NRS Card Manager (SQLite)
-- Run this after creating the database and tables

-- Insert sample employees
-- Note: EMP001 (John Doe) is set as a manager, others are staff
INSERT INTO employees (id, name, employeeId, email, id_prefix, role, photoPresent, createdAt, updatedAt) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'John Doe', '001', 'john.doe@company.com', 'IR', 'manager', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
