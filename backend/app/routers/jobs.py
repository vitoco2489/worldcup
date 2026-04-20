from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_cron_ok
from app.services import job_service

router = APIRouter(tags=["jobs"])


@router.post("/jobs/run")
def run_jobs(
    db: Session = Depends(get_db),
    cron_ok: bool = Depends(get_optional_cron_ok),
):
    if not cron_ok:
        raise HTTPException(status_code=401, detail="Invalid cron secret")
    return job_service.run_maintenance_job(db)
