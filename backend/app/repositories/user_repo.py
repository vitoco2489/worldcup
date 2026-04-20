from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(User.email == email)).first()


def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def create(db: Session, *, name: str, email: str, created_at: datetime) -> User:
    user = User(id=uuid.uuid4(), name=name, email=email, created_at=created_at)
    db.add(user)
    db.flush()
    return user


def upsert_google_user(db: Session, *, name: str, email: str, now: datetime) -> User:
    existing = get_by_email(db, email)
    if existing:
        if existing.name != name:
            existing.name = name
        return existing
    return create(db, name=name, email=email, created_at=now)
