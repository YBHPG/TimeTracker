from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

Category = Literal["work", "personal", "study"]


# --- TimeInterval Schemas ---

class TimeIntervalBase(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None


class TimeIntervalCreate(TimeIntervalBase):
    id: Optional[str] = None


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
    category: Optional[Category] = "work"


class TaskCreate(TaskBase):
    id: Optional[str] = None
    auto_start: bool = True
    at: Optional[datetime] = None


class TimerActionPayload(BaseModel):
    at: Optional[datetime] = None
    interval_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: Optional[Category] = None
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


# --- Analytics Schemas ---

class SummaryDay(BaseModel):
    date: str
    total_seconds: int
    task_count: int
    has_running: bool


class SummaryTask(BaseModel):
    title: str
    category: Optional[str] = None
    total_seconds: int
    percent: float
    day_count: int
    first_date: str
    last_date: str


class SummaryCategory(BaseModel):
    category: Optional[str] = None
    total_seconds: int
    percent: float


class SummaryCompare(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    total_seconds: int
    delta_seconds: int
    delta_percent: float

    model_config = ConfigDict(populate_by_name=True)


class SummaryBucket(BaseModel):
    start: str
    end: str
    total_seconds: int
    task_count: int
    day_count: int


class SummaryOut(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    tz: str
    total_seconds: int
    total_minutes: int
    total_hours: float
    task_count: int
    day_count: int
    has_running: bool
    running_seconds: int
    days: Optional[List[SummaryDay]] = None
    tasks: Optional[List[SummaryTask]] = None
    categories: Optional[List[SummaryCategory]] = None
    buckets: Optional[List[SummaryBucket]] = None
    compare: Optional[SummaryCompare] = None

    model_config = ConfigDict(populate_by_name=True)


# --- Entries Schemas ---

class EntryOut(BaseModel):
    task_id: str
    task_title: str
    category: Optional[str] = None
    date: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    is_running: bool


class EntriesOut(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    count: int
    entries: List[EntryOut]

    model_config = ConfigDict(populate_by_name=True)


# --- Meta Schemas ---

class CategoryInfo(BaseModel):
    id: str
    label: str


class MetaOut(BaseModel):
    api_version: str
    categories: List[CategoryInfo]
    default_tz: str
