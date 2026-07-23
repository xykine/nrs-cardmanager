import io
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Card, Employee, BookmarkedEmployee, ApiKey
from ..qr_token import encrypt_employee_id, decrypt_employee_id
from ..schemas import CardOut, CardSave, QrDecodeRequest, QrDecodeResponse
from .api_keys import require_api_key
from .notifications import add_bookmarked_employee_notification
from ..utils.auto_framing import calculate_auto_frame_params

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

    # Intercept untouched crops and run AI auto-framing
    use_x, use_y, use_scale = payload.photo_x, payload.photo_y, payload.photo_scale
    if payload.photo_data and use_x == 0 and use_y == 0 and abs(use_scale - 1.0) < 0.01:
        auto_x, auto_y, auto_scale_str = calculate_auto_frame_params(payload.photo_data)
        use_x, use_y = auto_x, auto_y
        use_scale = float(auto_scale_str)

    if card:
        card.photo_data = payload.photo_data
        card.photo_x = use_x
        card.photo_y = use_y
        card.photo_scale = str(use_scale)
    else:
        card = Card(
            employee_id=employee_id,
            photo_data=payload.photo_data,
            photo_x=use_x,
            photo_y=use_y,
            photo_scale=str(use_scale)
        )
        db.add(card)

    had_photo = bool(employee.photo_present)
    employee.photo_present = True
    if payload.photo_data:
        add_bookmarked_employee_notification(
            db,
            employee,
            action_type="photo_uploaded" if not had_photo else "photo_updated",
            title="Photo Updated",
            message=(
                f"{employee.name or employee.employee_id} "
                f"{'uploaded a photo' if not had_photo else 'updated photo data'}."
            ),
            payload={"hasPhoto": True},
        )
        bookmarked = (
            db.query(BookmarkedEmployee)
            .filter(BookmarkedEmployee.employee_id == employee.employee_id)
            .first()
        )
        if bookmarked:
            db.delete(bookmarked)

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

    token = encrypt_employee_id(employee.employee_id)

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


@router.post("/qr/decode", response_model=QrDecodeResponse)
def decode_qr_token(
    payload: QrDecodeRequest,
    _api_key: ApiKey = Depends(require_api_key),
):
    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    try:
        employee_id = decrypt_employee_id(token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid QR token") from None

    return QrDecodeResponse(employee_id=employee_id)
