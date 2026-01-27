
import sys
import os

# Add the src directory to python path
sys.path.append(os.path.join(os.getcwd(), "src"))

from app.db import SessionLocal
from app.models import Admin

def check_admins():
    db = SessionLocal()
    try:
        admins = db.query(Admin).all()
        print(f"Found {len(admins)} admins:")
        for admin in admins:
            print(f"ID: {admin.id}, IR: {admin.ir_number}, Name: {admin.name}, Password: {admin.password}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_admins()
