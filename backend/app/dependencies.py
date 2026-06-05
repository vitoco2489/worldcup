from __future__ import annotations

import uuid

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import user_repo
from app.services.allowlist_service import EmailNotAllowedError, assert_email_allowed
from app.utils.admin import is_admin_email
from app.utils.jwt_tokens import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> uuid.UUID:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    uid = decode_access_token(creds.credentials)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return uid


def get_optional_cron_ok(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
) -> bool:
    from app.config import get_settings

    s = get_settings().cron_secret
    if not s:
        return True
    return x_cron_secret == s


def require_user(db: Session, user_id: uuid.UUID):
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    try:
        assert_email_allowed(db, user.email)
    except EmailNotAllowedError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    return user


def get_admin_user(
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    user = require_user(db, user_id)
    if not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Admin only")
    return user
