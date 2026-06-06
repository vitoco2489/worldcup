import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.user_history import UserBetHistoryPublic
from app.services import user_history_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/bet-history", response_model=UserBetHistoryPublic)
def get_user_bet_history(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    viewer_id: uuid.UUID = Depends(get_current_user_id),
):
    require_user(db, viewer_id)
    return user_history_service.user_bet_history(db, user_id)
