from typing import List
from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas, crud

router = APIRouter(prefix="/api/days", tags=["Calendar & History"])


@router.get("", response_model=List[schemas.DayStatItem])
def list_days_stats(
    db: Session = Depends(get_db),
):
    """Get list of all recorded dates with task counts and total duration (for calendar highlighting)."""
    return crud.get_days_stats(db)


@router.get("/{date_str}/summary", response_model=schemas.DaySummaryOut)
def get_day_summary(
    date_str: str = Path(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """Get full summary for a specific day including all tasks and total duration."""
    tasks = crud.get_tasks_by_date(db, date_str)
    total_seconds = sum(t.total_duration_seconds for t in tasks)
    has_active = any(t.is_active for t in tasks)

    return schemas.DaySummaryOut(
        date=date_str,
        total_seconds=total_seconds,
        task_count=len(tasks),
        has_active_task=has_active,
        tasks=tasks,
    )
