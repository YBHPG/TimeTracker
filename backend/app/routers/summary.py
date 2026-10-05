from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import analytics, schemas
from app.config import DEFAULT_TZ
from app.database import get_db
from app.timeutils import get_zone, parse_iso_date, resolve_period, today_in_tz

router = APIRouter(prefix="/api", tags=["Analytics"])

_ALLOWED_GROUPS = {"task", "category", "day"}


def parse_date_or_422(value: str, field: str):
    try:
        return parse_iso_date(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid {field}: {value}")


@router.get("/summary", response_model=schemas.SummaryOut)
def get_summary(
    from_: Optional[str] = Query(None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_: Optional[str] = Query(None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    period: Optional[Literal["day", "week", "month"]] = Query(None),
    anchor: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz: str = Query(DEFAULT_TZ),
    group: str = Query("task,category,day"),
    round_mode: Literal["none", "minute"] = Query("none", alias="round"),
    compare: bool = Query(False),
    bucket: Optional[Literal["week", "month"]] = Query(None),
    db: Session = Depends(get_db),
):
    """Aggregated totals for a date range or a named period."""
    try:
        get_zone(tz)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {tz}")

    groups = {g.strip() for g in group.split(",") if g.strip()}
    if not groups or not groups <= _ALLOWED_GROUPS:
        raise HTTPException(status_code=400, detail="Invalid group. Allowed values: task, category, day")

    if period:
        anchor_date = parse_date_or_422(anchor, "anchor") if anchor else today_in_tz(tz)
        try:
            from_date, to_date = resolve_period(period, anchor_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    elif from_ and to_:
        from_date = parse_date_or_422(from_, "from")
        to_date = parse_date_or_422(to_, "to")
    else:
        raise HTTPException(status_code=400, detail="Provide either 'from'+'to' or 'period'")

    if from_date > to_date:
        raise HTTPException(status_code=400, detail="'from' must be earlier than or equal to 'to'")

    return analytics.get_summary(
        db,
        from_date=from_date,
        to_date=to_date,
        tz=tz,
        groups=groups,
        round_mode=round_mode,
        compare=compare,
        bucket=bucket,
    )
