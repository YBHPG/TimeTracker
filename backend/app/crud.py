from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Task, TimeInterval, utc_now, generate_uuid
from app import schemas


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC for correct ISO serialization with 'Z'."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def compute_interval_duration(interval: TimeInterval) -> int:
    """Computes interval duration in seconds. If active (end_time is None), computes relative to now."""
    start = ensure_utc(interval.start_time)
    if interval.end_time is not None:
        end = ensure_utc(interval.end_time)
        return max(0, int((end - start).total_seconds()))
    else:
        now = datetime.now(timezone.utc)
        return max(0, int((now - start).total_seconds()))


def enrich_task_out(task: Task) -> schemas.TaskOut:
    """Enriches a Task model into TaskOut with calculated duration, active status and intervals."""
    total_seconds = 0
    is_active = False
    active_interval_id = None
    intervals_out = []

    for inv in task.intervals:
        dur = compute_interval_duration(inv)
        total_seconds += dur
        if inv.end_time is None:
            is_active = True
            active_interval_id = inv.id

        intervals_out.append(
            schemas.TimeIntervalOut(
                id=inv.id,
                task_id=inv.task_id,
                start_time=ensure_utc(inv.start_time),
                end_time=ensure_utc(inv.end_time),
                duration_seconds=dur,
                created_at=ensure_utc(inv.created_at),
                updated_at=ensure_utc(inv.updated_at),
            )
        )

    return schemas.TaskOut(
        id=task.id,
        date=task.date,
        title=task.title,
        category=getattr(task, "category", "work") or "work",
        order_index=task.order_index,
        created_at=ensure_utc(task.created_at),
        updated_at=ensure_utc(task.updated_at),
        intervals=intervals_out,
        is_active=is_active,
        total_duration_seconds=total_seconds,
        active_interval_id=active_interval_id,
    )


def pause_all_active_intervals(db: Session, except_task_id: Optional[str] = None, at: Optional[datetime] = None) -> int:
    """Pauses all currently active intervals across all tasks (except optionally for a specific task)."""
    now = at or utc_now()
    query = db.query(TimeInterval).filter(TimeInterval.end_time.is_(None))
    if except_task_id:
        query = query.filter(TimeInterval.task_id != except_task_id)

    active_intervals = query.all()
    count = len(active_intervals)
    for inv in active_intervals:
        inv.end_time = now
        inv.updated_at = now
    if count > 0:
        db.commit()
    return count


def get_task(db: Session, task_id: str) -> Optional[Task]:
    return db.query(Task).filter(Task.id == task_id).first()


def get_tasks_by_date(db: Session, date_str: str) -> List[schemas.TaskOut]:
    tasks = (
        db.query(Task)
        .filter(Task.date == date_str)
        .order_by(Task.order_index.asc(), Task.created_at.asc())
        .all()
    )
    return [enrich_task_out(t) for t in tasks]


def create_task(db: Session, task_in: schemas.TaskCreate) -> schemas.TaskOut:
    create_dt = task_in.at or utc_now()

    # If auto_start is true, pause any other active timers first
    if task_in.auto_start:
        pause_all_active_intervals(db, at=create_dt)

    cleaned_title = task_in.title.strip()
    category = task_in.category or "work"

    # If task with the same name already exists for this date, add new interval to it
    tasks_for_date = db.query(Task).filter(Task.date == task_in.date).all()
    existing_task = next(
        (t for t in tasks_for_date if t.title.strip().casefold() == cleaned_title.casefold()),
        None
    )

    if existing_task:
        if task_in.category:
            existing_task.category = task_in.category

        if task_in.auto_start:
            # Check if already has an active interval running
            active_inv = (
                db.query(TimeInterval)
                .filter(TimeInterval.task_id == existing_task.id, TimeInterval.end_time.is_(None))
                .first()
            )
            if not active_inv:
                interval = TimeInterval(
                    task_id=existing_task.id,
                    start_time=create_dt,
                    end_time=None,
                )
                db.add(interval)

        existing_task.updated_at = create_dt
        db.commit()
        db.refresh(existing_task)
        return enrich_task_out(existing_task)

    # Get max order_index for this date
    max_order = (
        db.query(func.max(Task.order_index))
        .filter(Task.date == task_in.date)
        .scalar()
    )
    next_order = (max_order or 0) + 1

    task = Task(
        id=task_in.id or generate_uuid(),
        title=cleaned_title,
        date=task_in.date,
        category=category,
        order_index=next_order,
        created_at=create_dt,
        updated_at=create_dt,
    )
    db.add(task)
    db.flush()

    if task_in.auto_start:
        interval = TimeInterval(
            task_id=task.id,
            start_time=create_dt,
            end_time=None,
        )
        db.add(interval)

    db.commit()
    db.refresh(task)
    return enrich_task_out(task)


def update_task(db: Session, task_id: str, task_in: schemas.TaskUpdate) -> Optional[schemas.TaskOut]:
    task = get_task(db, task_id)
    if not task:
        return None

    if task_in.title is not None:
        task.title = task_in.title.strip()
    if task_in.date is not None:
        task.date = task_in.date
    if task_in.category is not None:
        task.category = task_in.category
    if task_in.order_index is not None:
        task.order_index = task_in.order_index

    task.updated_at = utc_now()
    db.commit()
    db.refresh(task)
    return enrich_task_out(task)


def delete_task(db: Session, task_id: str) -> bool:
    task = get_task(db, task_id)
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def bulk_delete_tasks(db: Session, task_ids: List[str]) -> int:
    if not task_ids:
        return 0
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all()
    count = len(tasks)
    for t in tasks:
        db.delete(t)
    db.commit()
    return count


def start_task_timer(db: Session, task_id: str, at: Optional[datetime] = None, interval_id: Optional[str] = None) -> Optional[schemas.TaskOut]:
    task = get_task(db, task_id)
    if not task:
        return None

    start_dt = at or utc_now()

    # Check if already active
    active_inv = (
        db.query(TimeInterval)
        .filter(TimeInterval.task_id == task_id, TimeInterval.end_time.is_(None))
        .first()
    )
    if active_inv:
        # Already running, but ensure other tasks are paused
        pause_all_active_intervals(db, except_task_id=task_id, at=start_dt)
        return enrich_task_out(task)

    # Pause any other active timer
    pause_all_active_intervals(db, at=start_dt)

    # Start new interval
    new_inv = TimeInterval(
        id=interval_id or generate_uuid(),
        task_id=task.id,
        start_time=start_dt,
        end_time=None,
    )
    db.add(new_inv)
    task.updated_at = start_dt
    db.commit()
    db.refresh(task)
    return enrich_task_out(task)


def pause_task_timer(db: Session, task_id: str, at: Optional[datetime] = None) -> Optional[schemas.TaskOut]:
    task = get_task(db, task_id)
    if not task:
        return None

    pause_dt = at or utc_now()
    active_intervals = (
        db.query(TimeInterval)
        .filter(TimeInterval.task_id == task_id, TimeInterval.end_time.is_(None))
        .all()
    )
    for inv in active_intervals:
        inv.end_time = pause_dt
        inv.updated_at = pause_dt

    task.updated_at = pause_dt
    db.commit()
    db.refresh(task)
    return enrich_task_out(task)


def add_interval(db: Session, task_id: str, interval_in: schemas.TimeIntervalCreate) -> Optional[schemas.TimeIntervalOut]:
    task = get_task(db, task_id)
    if not task:
        return None

    if interval_in.end_time is None:
        pause_all_active_intervals(db, at=interval_in.start_time)

    inv = TimeInterval(
        id=interval_in.id or generate_uuid(),
        task_id=task_id,
        start_time=interval_in.start_time,
        end_time=interval_in.end_time,
    )
    db.add(inv)
    task.updated_at = utc_now()
    db.commit()
    db.refresh(inv)

    dur = compute_interval_duration(inv)
    return schemas.TimeIntervalOut(
        id=inv.id,
        task_id=inv.task_id,
        start_time=ensure_utc(inv.start_time),
        end_time=ensure_utc(inv.end_time),
        duration_seconds=dur,
        created_at=ensure_utc(inv.created_at),
        updated_at=ensure_utc(inv.updated_at),
    )


def update_interval(db: Session, interval_id: str, interval_in: schemas.TimeIntervalUpdate) -> Optional[schemas.TimeIntervalOut]:
    inv = db.query(TimeInterval).filter(TimeInterval.id == interval_id).first()
    if not inv:
        return None

    if interval_in.start_time is not None:
        inv.start_time = interval_in.start_time
    if interval_in.end_time is not None:
        inv.end_time = interval_in.end_time

    inv.updated_at = utc_now()
    db.commit()
    db.refresh(inv)

    dur = compute_interval_duration(inv)
    return schemas.TimeIntervalOut(
        id=inv.id,
        task_id=inv.task_id,
        start_time=ensure_utc(inv.start_time),
        end_time=ensure_utc(inv.end_time),
        duration_seconds=dur,
        created_at=ensure_utc(inv.created_at),
        updated_at=ensure_utc(inv.updated_at),
    )


def delete_interval(db: Session, interval_id: str) -> bool:
    inv = db.query(TimeInterval).filter(TimeInterval.id == interval_id).first()
    if not inv:
        return False
    db.delete(inv)
    db.commit()
    return True


def get_days_stats(db: Session) -> List[schemas.DayStatItem]:
    """Returns aggregated stats for all dates that have tasks."""
    tasks = db.query(Task).all()
    days_map = {}

    for t in tasks:
        d = t.date
        if d not in days_map:
            days_map[d] = {"date": d, "total_seconds": 0, "task_count": 0, "has_active_task": False}
        days_map[d]["task_count"] += 1

        for inv in t.intervals:
            dur = compute_interval_duration(inv)
            days_map[d]["total_seconds"] += dur
            if inv.end_time is None:
                days_map[d]["has_active_task"] = True

    result = [schemas.DayStatItem(**val) for val in days_map.values()]
    result.sort(key=lambda x: x.date, reverse=True)
    return result
