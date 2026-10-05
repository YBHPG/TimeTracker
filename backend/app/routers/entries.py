from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import analytics, schemas
from app.config import DEFAULT_TZ
from app.database import get_db
from app.routers.summary import parse_date_or_422
from app.timeutils import get_zone

router = APIRouter(prefix="/api", tags=["Analytics"])


@router.get("/entries", response_model=schemas.EntriesOut)
def get_entries(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_: str = Query(..., alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz: str = Query(DEFAULT_TZ),
    task: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    include_running: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Flat JSON list of time intervals (JSON counterpart of the CSV export)."""
    try:
        get_zone(tz)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {tz}")

    from_date = parse_date_or_422(from_, "from")
    to_date = parse_date_or_422(to_, "to")
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="'from' must be earlier than or equal to 'to'")

    return analytics.get_entries(
        db,
        from_date=from_date,
        to_date=to_date,
        task=task,
        category=category,
        include_running=include_running,
    )
