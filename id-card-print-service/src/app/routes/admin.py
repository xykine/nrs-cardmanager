from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..db import get_db
from ..models import Admin
from ..schemas import AdminLogin, AdminOut

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/login", response_model=AdminOut)
def admin_login(payload: AdminLogin, db: Session = Depends(get_db)):
    # Simple password check for now as requested
    admin = db.query(Admin).filter(Admin.ir_number == payload.ir_number).first()
    
    if not admin or admin.password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid IR Number or Password")
        
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
