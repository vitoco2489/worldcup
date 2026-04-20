from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.community import CommunityMatchRow
from app.services import community_service

router = APIRouter(prefix="/community", tags=["community"])


@router.get("", response_model=list[CommunityMatchRow])
def community_overview(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return community_service.community_overview(db)
