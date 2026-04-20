from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Employee, EmployeeNotification
from ..schemas import EmployeeNotificationListOut, EmployeeNotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def add_bookmarked_employee_notification(
    db: Session,
    employee: Employee,
    *,
    action_type: str,
    title: str,
    message: str,
    payload: Optional[dict[str, Any]] = None,
) -> Optional[EmployeeNotification]:
    if not employee or not employee.is_bookmarked:
        return None

    notification = EmployeeNotification(
        employee_id=employee.id,
        action_type=action_type,
        title=title,
        message=message,
        payload=payload,
        is_read=False,
    )
    db.add(notification)
    return notification


@router.get("/", response_model=EmployeeNotificationListOut)
def list_notifications(
    unread_only: bool = Query(False, alias="unreadOnly"),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(EmployeeNotification).options(
        joinedload(EmployeeNotification.employee).joinedload(Employee.bookmark)
    )
    if unread_only:
        query = query.filter(EmployeeNotification.is_read.is_(False))

    total = query.count()
    unread = (
        db.query(EmployeeNotification)
        .filter(EmployeeNotification.is_read.is_(False))
        .count()
    )
    items = query.order_by(EmployeeNotification.created_at.desc()).limit(limit).all()
    return EmployeeNotificationListOut(items=items, total=total, unread=unread)


@router.get("/count")
def get_notification_count(db: Session = Depends(get_db)):
    unread = (
        db.query(EmployeeNotification)
        .filter(EmployeeNotification.is_read.is_(False))
        .count()
    )
    total = db.query(EmployeeNotification).count()
    return {"unread": unread, "total": total}


@router.patch("/{notification_id}/read", response_model=EmployeeNotificationOut)
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    notification = (
        db.query(EmployeeNotification)
        .options(joinedload(EmployeeNotification.employee))
        .filter(EmployeeNotification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    updated = (
        db.query(EmployeeNotification)
        .filter(EmployeeNotification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "updated": updated}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    notification = (
        db.query(EmployeeNotification)
        .filter(EmployeeNotification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notification)
    db.commit()
    return {"ok": True}
