import csv
import io
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Task, TimeInterval
from app.crud import compute_interval_duration

router = APIRouter(prefix="/api/export", tags=["Export"])


@router.get("/csv")
def export_csv(
    date_from: str = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
):
    """Export time tracking records as CSV."""
    query = db.query(Task).order_by(Task.date.desc(), Task.created_at.asc())
    if date_from:
        query = query.filter(Task.date >= date_from)
    if date_to:
        query = query.filter(Task.date <= date_to)

    tasks = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Task ID",
        "Date",
        "Title",
        "Category",
        "Interval ID",
        "Start Time (UTC)",
        "End Time (UTC)",
        "Duration (Seconds)",
        "Duration (Formatted)",
    ])

    for task in tasks:
        task_category = getattr(task, "category", "work") or "work"
        if not task.intervals:
            writer.writerow([
                task.id,
                task.date,
                task.title,
                task_category,
                "",
                "",
                "",
                0,
                "00:00:00",
            ])
        else:
            for inv in task.intervals:
                dur = compute_interval_duration(inv)
                hours = dur // 3600
                minutes = (dur % 3600) // 60
                seconds = dur % 60
                formatted_dur = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

                writer.writerow([
                    task.id,
                    task.date,
                    task.title,
                    task_category,
                    inv.id,
                    inv.start_time.isoformat() if inv.start_time else "",
                    inv.end_time.isoformat() if inv.end_time else "RUNNING",
                    dur,
                    formatted_dur,
                ])

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=timetracker_export.csv"},
    )
