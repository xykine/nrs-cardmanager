"""Customer API key management and authentication dependency."""

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ApiKey
from ..schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut

router = APIRouter(prefix="/admin/api-keys", tags=["api-keys"])


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _generate_api_key() -> str:
    return f"nrs_{secrets.token_hex(16)}"


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> ApiKey:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    key_hash = _hash_api_key(x_api_key)
    api_key = (
        db.query(ApiKey)
        .filter(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
        .first()
    )
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    api_key.last_used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(api_key)
    return api_key


@router.get("", response_model=list[ApiKeyOut])
def list_api_keys(db: Session = Depends(get_db)):
    return (
        db.query(ApiKey)
        .order_by(ApiKey.created_at.desc())
        .all()
    )


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_api_key(payload: ApiKeyCreate, db: Session = Depends(get_db)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    raw_key = _generate_api_key()
    api_key = ApiKey(
        name=name,
        key_prefix=raw_key[:8],
        key_hash=_hash_api_key(raw_key),
        is_active=True,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        key=raw_key,
    )


@router.delete("/{key_id}", response_model=ApiKeyOut)
def revoke_api_key(key_id: str, db: Session = Depends(get_db)):
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    db.commit()
    db.refresh(api_key)
    return api_key


@router.post("/{key_id}/reactivate", response_model=ApiKeyOut)
def reactivate_api_key(key_id: str, db: Session = Depends(get_db)):
    """Re-enable a revoked key. The original secret still works if the customer kept it."""
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    if api_key.is_active:
        raise HTTPException(status_code=400, detail="API key is already active")

    api_key.is_active = True
    db.commit()
    db.refresh(api_key)
    return api_key


@router.post("/{key_id}/regenerate", response_model=ApiKeyCreated)
def regenerate_api_key(key_id: str, db: Session = Depends(get_db)):
    """Issue a new secret for this customer/integration. The previous secret stops working."""
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    raw_key = _generate_api_key()
    api_key.key_prefix = raw_key[:8]
    api_key.key_hash = _hash_api_key(raw_key)
    api_key.is_active = True
    db.commit()
    db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        key=raw_key,
    )
