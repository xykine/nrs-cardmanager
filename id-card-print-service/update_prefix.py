import sys
import logging
from sqlalchemy.orm import Session
from src.app.db import SessionLocal
from src.app.models import Employee

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_prefixes():
    """
    Manually triggereable script to update id_prefix to 'CS' for employees
    whose employeeId starts with '900' or '00'.
    """
    db: Session = SessionLocal()
    try:
        employees = db.query(Employee).filter(
            Employee.employee_id.startswith('900') | Employee.employee_id.startswith('00')
        ).all()
        
        updated_count = 0
        for emp in employees:
            if emp.id_prefix != 'CS':
                emp.id_prefix = 'CS'
                updated_count += 1
                
        db.commit()
        logger.info(f"Successfully updated prefix to 'CS' for {updated_count} employees.")
    except Exception as e:
        logger.error(f"Failed to update prefixes: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("This will update idPrefix to 'CS' for all employees with IDs starting with 900 or 00. Continue? [y/N]: ")
    if confirm.lower().strip() == 'y':
        update_prefixes()
    else:
        print("Operation cancelled.")
