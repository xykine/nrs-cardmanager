"""Shared Fernet helpers for QR-code employee ID tokens."""

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def get_fernet() -> Fernet:
    secret_key = os.getenv("QR_SECRET_KEY", "default-secret-key-for-qr")
    key = hashlib.sha256(secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def encrypt_employee_id(employee_id: str) -> str:
    return get_fernet().encrypt(employee_id.encode()).decode()


def decrypt_employee_id(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception) as exc:
        raise ValueError("Invalid QR token") from exc
