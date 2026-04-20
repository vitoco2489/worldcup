from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt

from app.config import get_settings


def create_access_token(user_id: UUID, *, expires_hours: int = 720) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> UUID | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        sub = payload.get("sub")
        if not sub:
            return None
        return UUID(str(sub))
    except JWTError:
        return None
