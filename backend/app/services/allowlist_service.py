from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.allowed_email import AllowedEmail
from app.models.user import User
from app.utils.admin import ADMIN_EMAIL
from app.utils.time import utc_now


class EmailNotAllowedError(PermissionError):
    """Raised when a Google account is not on the invite list."""


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def is_email_allowed(db: Session, email: str) -> bool:
    key = normalize_email(email)
    if not key:
        return False
    return db.get(AllowedEmail, key) is not None


def seed_allowlist_if_empty(db: Session) -> None:
    """Ensure admin and every registered account appear on the invite list."""
    now = utc_now()
    admin_key = normalize_email(ADMIN_EMAIL)
    if db.get(AllowedEmail, admin_key) is None:
        db.add(AllowedEmail(email=admin_key, note="Administrador", created_at=now))

    for user in db.scalars(select(User).order_by(User.email.asc())):
        key = normalize_email(user.email)
        if not key or db.get(AllowedEmail, key) is not None:
            continue
        note = (user.name or "").strip() or "Usuario registrado"
        db.add(AllowedEmail(email=key, note=note, created_at=now))


def list_allowed(db: Session) -> list[AllowedEmail]:
    return list(db.scalars(select(AllowedEmail).order_by(AllowedEmail.email.asc())).all())


def add_allowed(db: Session, email: str, *, note: str | None = None) -> AllowedEmail:
    key = normalize_email(email)
    if "@" not in key or "." not in key.split("@")[-1]:
        raise ValueError("Correo inválido")
    existing = db.get(AllowedEmail, key)
    if existing:
        if note is not None and note.strip():
            existing.note = note.strip()
        return existing
    row = AllowedEmail(email=key, note=(note.strip() if note else None), created_at=utc_now())
    db.add(row)
    db.flush()
    return row


def remove_allowed(db: Session, email: str) -> None:
    key = normalize_email(email)
    if key == normalize_email(ADMIN_EMAIL):
        raise ValueError("No se puede quitar al administrador principal")
    row = db.get(AllowedEmail, key)
    if row:
        db.delete(row)


def assert_email_allowed(db: Session, email: str) -> None:
    if not is_email_allowed(db, email):
        raise EmailNotAllowedError(
            "Tu correo no está autorizado. Pide al administrador que te agregue a la lista de invitados."
        )
