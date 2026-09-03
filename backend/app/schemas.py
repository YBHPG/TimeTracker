from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


# --- TimeInterval Schemas ---

class TimeIntervalBase(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None


class TimeIntervalCreate(TimeIntervalBase):
    pass


class TimeIntervalUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class TimeIntervalOut(TimeIntervalBase):
    id: str
    task_id: str
    duration_seconds: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Task Schemas ---

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: Optional[str] = "work"


class TaskCreate(TaskBase):
    auto_start: bool = True


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: Optional[str] = None
    order_index: Optional[int] = None


class TaskOut(TaskBase):
    id: str
    order_index: int
    created_at: datetime
    updated_at: datetime
    intervals: List[TimeIntervalOut] = []
    is_active: bool = False
    total_duration_seconds: int = 0
    active_interval_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Calendar & Stats Schemas ---

class DayStatItem(BaseModel):
    date: str  # YYYY-MM-DD
    total_seconds: int
    task_count: int
    has_active_task: bool = False


class DaySummaryOut(BaseModel):
    date: str
    total_seconds: int
    task_count: int
    has_active_task: bool
    tasks: List[TaskOut]


class BulkDeleteTasksPayload(BaseModel):
    task_ids: List[str]
