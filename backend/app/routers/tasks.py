from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas, crud

router = APIRouter(prefix="/api", tags=["Tasks & Timers"])


@router.get("/tasks", response_model=List[schemas.TaskOut])
def list_tasks(
    date_str: Optional[str] = Query(None, alias="date", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """Retrieve all tasks for a specific date (defaults to today in UTC if not specified)."""
    target_date = date_str if date_str else date.today().isoformat()
    return crud.get_tasks_by_date(db, target_date)


@router.post("/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
):
    """Create a new task for a given day. If auto_start is True, starts timer immediately and pauses others."""
    return crud.create_task(db, task_in)


@router.get("/tasks/{task_id}", response_model=schemas.TaskOut)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
):
    """Get a single task by ID."""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return crud.enrich_task_out(task)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: str,
    task_in: schemas.TaskUpdate,
    db: Session = Depends(get_db),
):
    """Update task title, date, or display order."""
    task = crud.update_task(db, task_id, task_in)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
):
    """Delete a task and all associated time intervals."""
    success = crud.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@router.post("/tasks/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_tasks(
    payload: schemas.BulkDeleteTasksPayload,
    db: Session = Depends(get_db),
):
    """Delete multiple tasks and their associated time intervals at once."""
    crud.bulk_delete_tasks(db, payload.task_ids)
    return None


@router.post("/tasks/{task_id}/start", response_model=schemas.TaskOut)
def start_timer(
    task_id: str,
    db: Session = Depends(get_db),
):
    """Start or resume timer on this task. Pauses any other active timer."""
    task = crud.start_task_timer(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/tasks/{task_id}/pause", response_model=schemas.TaskOut)
def pause_timer(
    task_id: str,
    db: Session = Depends(get_db),
):
    """Pause timer on this task."""
    task = crud.pause_task_timer(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# --- Interval Endpoints ---

@router.post("/tasks/{task_id}/intervals", response_model=schemas.TimeIntervalOut, status_code=status.HTTP_201_CREATED)
def add_task_interval(
    task_id: str,
    interval_in: schemas.TimeIntervalCreate,
    db: Session = Depends(get_db),
):
    """Manually add a time interval to a task."""
    if interval_in.end_time and interval_in.end_time < interval_in.start_time:
        raise HTTPException(status_code=400, detail="End time cannot be earlier than start time")

    inv = crud.add_interval(db, task_id, interval_in)
    if not inv:
        raise HTTPException(status_code=404, detail="Task not found")
    return inv


@router.put("/intervals/{interval_id}", response_model=schemas.TimeIntervalOut)
def edit_interval(
    interval_id: str,
    interval_in: schemas.TimeIntervalUpdate,
    db: Session = Depends(get_db),
):
    """Update start or end time of an existing interval."""
    if (
        interval_in.start_time
        and interval_in.end_time
        and interval_in.end_time < interval_in.start_time
    ):
        raise HTTPException(status_code=400, detail="End time cannot be earlier than start time")

    inv = crud.update_interval(db, interval_id, interval_in)
    if not inv:
        raise HTTPException(status_code=404, detail="Interval not found")
    return inv


@router.delete("/intervals/{interval_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interval(
    interval_id: str,
    db: Session = Depends(get_db),
):
    """Delete a specific interval."""
    success = crud.delete_interval(db, interval_id)
    if not success:
        raise HTTPException(status_code=404, detail="Interval not found")
    return None
