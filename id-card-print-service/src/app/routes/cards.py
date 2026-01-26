import os
import io
import hmac
import hashlib
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload
from cryptography.fernet import Fernet

from ..db import get_db
from ..models import Card, Employee
from ..schemas import CardOut, CardSave

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/employee/{employee_id}", response_model=CardOut)
def get_card_by_employee(employee_id: str, db: Session = Depends(get_db)):
    card = (
        db.query(Card)
        .options(joinedload(Card.employee))
        .filter(Card.employee_id == employee_id)
        .first()
    )

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return card


@router.post("/employee/{employee_id}", response_model=CardOut)
def save_card(employee_id: str, payload: CardSave, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    card = db.query(Card).filter(Card.employee_id == employee_id).first()

    if card:
        card.photo_data = payload.photo_data
        card.photo_x = payload.photo_x
        card.photo_y = payload.photo_y
        card.photo_scale = str(payload.photo_scale)
    else:
        card = Card(
            employee_id=employee_id,
            photo_data=payload.photo_data,
            photo_x=payload.photo_x,
            photo_y=payload.photo_y,
            photo_scale=str(payload.photo_scale)
        )
        db.add(card)

    employee.photo_present = True

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save card") from exc

    db.refresh(card)
    return card


@router.get("/{card_id}/print", response_model=CardOut)
def get_card_for_print(card_id: str, db: Session = Depends(get_db)):
    card = (
        db.query(Card)
        .options(joinedload(Card.employee))
        .filter(Card.id == card_id)
        .first()
    )

    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return card

@router.get("/employee/{employee_id}/qr")
def get_employee_qr(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        # Check by internal ID if not found by employee_id string
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

    secret_key = os.getenv("QR_SECRET_KEY", "default-secret-key-for-qr")
    
    # We use the secret key to derive a Fernet key for encryption
    # In a real app, this should be a properly managed 32-byte base64 key.
    # Here we'll derive it simply for demonstration.
    key = hashlib.sha256(secret_key.encode()).digest()
    import base64
    fernet_key = base64.urlsafe_b64encode(key)
    f = Fernet(fernet_key)
    
    # Encrypt the employee_id
    token = f.encrypt(employee.employee_id.encode()).decode()
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()

    return Response(content=img_byte_arr, media_type="image/png")
