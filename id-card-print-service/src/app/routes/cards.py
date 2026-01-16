from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

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
    else:
        card = Card(employee_id=employee_id, photo_data=payload.photo_data)
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
