from __future__ import annotations

from sqlalchemy.orm import Session

from app.services import allowlist_service
from app.repositories import user_repo
from app.schemas.auth import UserPublic
from app.utils.google_auth import verify_google_id_token
from app.utils.jwt_tokens import create_access_token
from app.utils.time import utc_now


def login_with_google_id_token(db: Session, id_token: str) -> tuple[str, UserPublic]:
    info = verify_google_id_token(id_token)
    email = info.get("email")
    if not email:
        raise ValueError("Google token missing email")
    email_norm = str(email).lower()
    allowlist_service.assert_email_allowed(db, email_norm)
    name = str(info.get("name") or email_norm.split("@")[0])
    now = utc_now()
    user = user_repo.upsert_google_user(db, name=name, email=email_norm, now=now)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return token, UserPublic.model_validate(user)
