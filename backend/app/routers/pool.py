from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user_id, require_user
from app.schemas.pool import PoolPublic
from app.services import pool_service

router = APIRouter(tags=["pool"])


@router.get("/pool", response_model=PoolPublic)
def pool(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    require_user(db, user_id)
    return pool_service.get_pool(db)
