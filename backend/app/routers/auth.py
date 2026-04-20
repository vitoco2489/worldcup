from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.repositories import user_repo
from app.schemas.auth import LoginRequest, TokenResponse, UserPublic
from app.services import auth_service
from app.utils.admin import is_admin_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    try:
        token, _user = auth_service.login_with_google_id_token(db, body.id_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserPublic)
def me(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    user = require_user(db, user_id)
    base = UserPublic.model_validate(user)
    return base.model_copy(update={"is_admin": is_admin_email(user.email)})
