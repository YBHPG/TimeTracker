import calendar
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Set

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app import schemas
from app.crud import ensure_utc
from app.models import Task, TimeInterval
from app.timeutils import previous_range


def _now_str() -> str:
    """Current UTC timestamp in the format SQLite stores datetimes in."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


def _seconds_expr(now_str: str):
    """SQL expression: interval duration in seconds, running intervals counted up to now_str."""
    end = func.coalesce(TimeInterval.end_time, now_str)
    raw = func.strftime("%s", end) - func.strftime("%s", TimeInterval.start_time)
    return case((raw < 0, 0), else_=func.coalesce(raw, 0))


def _round(value: int, mode: str) -> int:
    value = int(value or 0)
    if mode == "minute":
        return int(round(value / 60.0) * 60)
    return value


def _percent(part: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(part / total * 100, 1)


def _base_query(db: Session, secs, from_str: str, to_str: str):
    return (
        db.query()
        .select_from(Task)
        .outerjoin(TimeInterval, TimeInterval.task_id == Task.id)
        .filter(Task.date >= from_str, Task.date <= to_str)
    )


def _compute_days(db: Session, secs, from_str: str, to_str: str):
    rows = (
        _base_query(db, secs, from_str, to_str)
        .with_entities(
            Task.date.label("date"),
            func.coalesce(func.sum(secs), 0).label("total_seconds"),
            func.count(func.distinct(Task.id)).label("task_count"),
            func.max(
                case(
                    (
                        and_(
                            TimeInterval.id.isnot(None),
                            TimeInterval.end_time.is_(None),
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("has_running"),
        )
        .group_by(Task.date)
        .order_by(Task.date.asc())
        .all()
    )
    return rows


def _compute_tasks(db: Session, secs, from_str: str, to_str: str):
    norm = func.casefold(func.trim(Task.title))
    rows = (
        _base_query(db, secs, from_str, to_str)
        .with_entities(
            norm.label("norm_title"),
            Task.category.label("category"),
            func.min(Task.title).label("title"),
            func.sum(secs).label("total_seconds"),
            func.count(func.distinct(Task.date)).label("day_count"),
            func.min(Task.date).label("first_date"),
            func.max(Task.date).label("last_date"),
        )
        .group_by(norm, Task.category)
        .all()
    )
    return rows


def _compute_categories(db: Session, secs, from_str: str, to_str: str):
    rows = (
        _base_query(db, secs, from_str, to_str)
        .with_entities(
            Task.category.label("category"),
            func.sum(secs).label("total_seconds"),
        )
        .group_by(Task.category)
        .all()
    )
    return rows


def _compute_buckets(db: Session, secs, from_str: str, to_str: str, bucket: str):
    key_expr = (
        func.strftime("%Y-%W", Task.date)
        if bucket == "week"
        else func.strftime("%Y-%m", Task.date)
    )
    rows = (
        _base_query(db, secs, from_str, to_str)
        .with_entities(
            key_expr.label("key"),
            func.min(Task.date).label("min_date"),
            func.coalesce(func.sum(secs), 0).label("total_seconds"),
            func.count(func.distinct(Task.id)).label("task_count"),
            func.count(func.distinct(Task.date)).label("day_count"),
        )
        .group_by("key")
        .order_by("key")
        .all()
    )

    buckets = []
    for r in rows:
        min_date = date.fromisoformat(r.min_date)
        if bucket == "week":
            start = min_date - timedelta(days=min_date.weekday())
            end = start + timedelta(days=6)
        else:
            start = min_date.replace(day=1)
            end = min_date.replace(day=calendar.monthrange(min_date.year, min_date.month)[1])
        buckets.append(
            schemas.SummaryBucket(
                start=start.isoformat(),
                end=end.isoformat(),
                total_seconds=int(r.total_seconds or 0),
                task_count=int(r.task_count or 0),
                day_count=int(r.day_count or 0),
            )
        )
    return buckets


def _totals_for_range(db: Session, secs, from_str: str, to_str: str) -> int:
    """Total tracked seconds (running counted to now) for a date range."""
    return int(
        _base_query(db, secs, from_str, to_str)
        .with_entities(func.coalesce(func.sum(secs), 0))
        .scalar()
        or 0
    )


def get_summary(
    db: Session,
    *,
    from_date: date,
    to_date: date,
    tz: str,
    groups: Set[str],
    round_mode: str,
    compare: bool,
    bucket: Optional[str] = None,
) -> schemas.SummaryOut:
    from_str = from_date.isoformat()
    to_str = to_date.isoformat()
    secs = _seconds_expr(_now_str())

    day_rows = _compute_days(db, secs, from_str, to_str)
    days = [
        schemas.SummaryDay(
            date=r.date,
            total_seconds=_round(r.total_seconds, round_mode),
            task_count=int(r.task_count or 0),
            has_running=bool(r.has_running),
        )
        for r in day_rows
    ]
    total_seconds = sum(d.total_seconds for d in days)

    running_seconds = int(
        _base_query(db, secs, from_str, to_str)
        .filter(TimeInterval.end_time.is_(None))
        .with_entities(func.coalesce(func.sum(secs), 0))
        .scalar()
        or 0
    )

    task_count = int(
        db.query(func.count(func.distinct(Task.id)))
        .filter(Task.date >= from_str, Task.date <= to_str)
        .scalar()
        or 0
    )

    tasks_out = None
    if "task" in groups:
        merged: dict = {}
        for r in _compute_tasks(db, secs, from_str, to_str):
            acc = merged.get(r.norm_title)
            if acc is None:
                acc = {
                    "title": r.title,
                    "total_seconds": 0,
                    "day_count": 0,
                    "first_date": r.first_date,
                    "last_date": r.last_date,
                    "cat_seconds": {},
                }
                merged[r.norm_title] = acc
            secs_val = int(r.total_seconds or 0)
            acc["total_seconds"] += secs_val
            acc["day_count"] += int(r.day_count or 0)
            acc["first_date"] = min(acc["first_date"], r.first_date)
            acc["last_date"] = max(acc["last_date"], r.last_date)
            acc["cat_seconds"][r.category] = acc["cat_seconds"].get(r.category, 0) + secs_val

        tasks_out = []
        for acc in merged.values():
            rounded = _round(acc["total_seconds"], round_mode)
            if rounded <= 0:
                continue
            dominant_cat = max(acc["cat_seconds"], key=acc["cat_seconds"].get)
            tasks_out.append(
                schemas.SummaryTask(
                    title=acc["title"],
                    category=dominant_cat,
                    total_seconds=rounded,
                    percent=_percent(rounded, total_seconds),
                    day_count=acc["day_count"],
                    first_date=acc["first_date"],
                    last_date=acc["last_date"],
                )
            )
        tasks_out.sort(key=lambda t: t.total_seconds, reverse=True)

    categories_out = None
    if "category" in groups:
        categories_out = []
        for r in _compute_categories(db, secs, from_str, to_str):
            rounded = _round(r.total_seconds, round_mode)
            if rounded <= 0:
                continue
            categories_out.append(
                schemas.SummaryCategory(
                    category=r.category,
                    total_seconds=rounded,
                    percent=_percent(rounded, total_seconds),
                )
            )
        categories_out.sort(key=lambda c: c.total_seconds, reverse=True)

    buckets_out = None
    if bucket:
        buckets_out = _compute_buckets(db, secs, from_str, to_str, bucket)
        for b in buckets_out:
            b.total_seconds = _round(b.total_seconds, round_mode)

    compare_out = None
    if compare:
        prev_from, prev_to = previous_range(from_date, to_date)
        prev_total = _totals_for_range(db, secs, prev_from.isoformat(), prev_to.isoformat())
        prev_total = _round(prev_total, round_mode)
        delta = total_seconds - prev_total
        compare_out = schemas.SummaryCompare(
            **{
                "from": prev_from.isoformat(),
                "to": prev_to.isoformat(),
                "total_seconds": prev_total,
                "delta_seconds": delta,
                "delta_percent": round(delta / prev_total * 100, 1) if prev_total else 0.0,
            }
        )

    return schemas.SummaryOut(
        **{
            "from": from_str,
            "to": to_str,
            "tz": tz,
            "total_seconds": total_seconds,
            "total_minutes": round(total_seconds / 60),
            "total_hours": round(total_seconds / 3600, 2),
            "task_count": task_count,
            "day_count": len(days),
            "has_running": running_seconds > 0,
            "running_seconds": running_seconds,
            "days": days if "day" in groups else None,
            "tasks": tasks_out,
            "categories": categories_out,
            "buckets": buckets_out,
            "compare": compare_out,
        }
    )


def get_entries(
    db: Session,
    *,
    from_date: date,
    to_date: date,
    task: Optional[str] = None,
    category: Optional[str] = None,
    include_running: bool = True,
) -> schemas.EntriesOut:
    from_str = from_date.isoformat()
    to_str = to_date.isoformat()
    secs = _seconds_expr(_now_str())

    query = (
        db.query(
            Task.id.label("task_id"),
            Task.title.label("task_title"),
            Task.category.label("category"),
            Task.date.label("date"),
            TimeInterval.start_time.label("start_time"),
            TimeInterval.end_time.label("end_time"),
            secs.label("duration_seconds"),
        )
        .select_from(Task)
        .join(TimeInterval, TimeInterval.task_id == Task.id)
        .filter(Task.date >= from_str, Task.date <= to_str)
    )
    if task:
        query = query.filter(func.casefold(Task.title).like(f"%{task.casefold()}%"))
    if category:
        query = query.filter(Task.category == category)
    if not include_running:
        query = query.filter(TimeInterval.end_time.isnot(None))

    query = query.order_by(Task.date.asc(), TimeInterval.start_time.asc())
    rows = query.all()

    entries = [
        schemas.EntryOut(
            task_id=r.task_id,
            task_title=r.task_title,
            category=r.category,
            date=r.date,
            start_time=ensure_utc(r.start_time),
            end_time=ensure_utc(r.end_time),
            duration_seconds=int(r.duration_seconds or 0),
            is_running=r.end_time is None,
        )
        for r in rows
    ]

    return schemas.EntriesOut(**{"from": from_str, "to": to_str, "count": len(entries), "entries": entries})
