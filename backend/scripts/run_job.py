"""Run pool maintenance locally or from a container (same logic as POST /jobs/run)."""

from app.database import SessionLocal
from app.services.job_service import run_maintenance_job


def main() -> None:
    db = SessionLocal()
    try:
        result = run_maintenance_job(db)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
