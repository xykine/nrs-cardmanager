from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..db import get_db
from ..models import Admin, Employee
from ..schemas import AdminLogin, AdminOut

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/login", response_model=AdminOut)
def admin_login(payload: AdminLogin, db: Session = Depends(get_db)):
    # Simple password check for now as requested
    
    if payload.ir_number:
        admin = db.query(Admin).filter(Admin.ir_number == payload.ir_number).first()
    else:
        # If no IR number, find the admin with the matching password
        # This assumes single admin or shared password for now
        admin = db.query(Admin).filter(Admin.password == payload.password).first()
    
    if not admin or admin.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid Credentials")
        
    return admin

def seed_admin(db: Session):
    # Check if any admin exists
    admin = db.query(Admin).first()
    if not admin:
        # Create a default admin
        new_admin = Admin(
            ir_number="ADMIN001",
            name="System Administrator",
            password="admin123"
        )
        db.add(new_admin)
        db.commit()
        print("Seeded default admin user.")

@router.post("/employees/update-prefixes")
def update_specific_employee_prefixes(db: Session = Depends(get_db)):
    """
    Manually triggereable endpoint to update id_prefix to 'CS' for employees
    whose employeeId starts with '900' or '00'.
    """
    employees = db.query(Employee).filter(
        Employee.employee_id.startswith('900') | Employee.employee_id.startswith('00')
    ).all()
    
    updated_count = 0
    for emp in employees:
        if emp.id_prefix != 'CS':
            emp.id_prefix = 'CS'
            updated_count += 1
            
    try:
        db.commit()
        return {"success": True, "updated_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
