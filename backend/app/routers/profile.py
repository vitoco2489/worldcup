from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.profile import UserStatsPublic
from app.services import profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/stats", response_model=UserStatsPublic)
def my_stats(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return profile_service.user_stats(db, user_id)
