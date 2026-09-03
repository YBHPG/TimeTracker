import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    date = Column(String(10), nullable=False, index=True)  # Format: YYYY-MM-DD
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=True, default="work")
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    intervals = relationship(
        "TimeInterval",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TimeInterval.start_time.asc()"
    )


class TimeInterval(Base):
    __tablename__ = "time_intervals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    end_time = Column(DateTime(timezone=True), nullable=True)  # None means active/running
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    task = relationship("Task", back_populates="intervals")
