import os
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Setup in-memory test database before importing app components
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.database import Base, get_db
from app.main import app

# Create in-memory SQLite engine for tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_task_with_autostart(client):
    payload = {
        "title": "Разработка модуля",
        "date": "2026-09-02",
        "auto_start": True
    }
    response = client.post("/api/tasks", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Разработка модуля"
    assert data["date"] == "2026-09-02"
    assert data["is_active"] is True
    assert len(data["intervals"]) == 1
    assert data["intervals"][0]["end_time"] is None


def test_single_active_timer_concurrency(client):
    # 1. Create first task with auto_start
    res1 = client.post("/api/tasks", json={"title": "Задача 1", "date": "2026-09-02", "auto_start": True})
    task1_id = res1.json()["id"]
    assert res1.json()["is_active"] is True

    # 2. Create second task with auto_start
    res2 = client.post("/api/tasks", json={"title": "Задача 2", "date": "2026-09-02", "auto_start": True})
    task2_id = res2.json()["id"]
    assert res2.json()["is_active"] is True

    # 3. Verify task 1 is now paused
    res1_updated = client.get(f"/api/tasks/{task1_id}")
    assert res1_updated.json()["is_active"] is False
    assert res1_updated.json()["intervals"][0]["end_time"] is not None

    # 4. Pause task 2
    res2_pause = client.post(f"/api/tasks/{task2_id}/pause")
    assert res2_pause.status_code == 200
    assert res2_pause.json()["is_active"] is False

    # 5. Resume task 1
    res1_resume = client.post(f"/api/tasks/{task1_id}/start")
    assert res1_resume.status_code == 200
    assert res1_resume.json()["is_active"] is True
    assert len(res1_resume.json()["intervals"]) == 2


def test_manual_interval_management(client):
    # Create task without auto_start
    res = client.post("/api/tasks", json={"title": "Задача без старта", "date": "2026-09-02", "auto_start": False})
    task_id = res.json()["id"]
    assert res.json()["is_active"] is False
    assert len(res.json()["intervals"]) == 0

    now = datetime.now(timezone.utc)
    t1 = (now - timedelta(hours=2)).isoformat()
    t2 = (now - timedelta(hours=1)).isoformat()

    # Add manual interval
    inv_res = client.post(f"/api/tasks/{task_id}/intervals", json={
        "start_time": t1,
        "end_time": t2
    })
    assert inv_res.status_code == 201
    interval_id = inv_res.json()["id"]
    assert inv_res.json()["duration_seconds"] == 3600

    # Edit interval
    t3 = (now - timedelta(minutes=30)).isoformat()
    edit_res = client.put(f"/api/intervals/{interval_id}", json={
        "end_time": t3
    })
    assert edit_res.status_code == 200
    assert edit_res.json()["duration_seconds"] == 5400  # 1.5 hours

    # Delete interval
    del_res = client.delete(f"/api/intervals/{interval_id}")
    assert del_res.status_code == 204

    # Verify task intervals empty
    task_check = client.get(f"/api/tasks/{task_id}")
    assert len(task_check.json()["intervals"]) == 0


def test_update_and_delete_task(client):
    res = client.post("/api/tasks", json={"title": "Устаревшая задача", "date": "2026-09-02", "auto_start": False})
    task_id = res.json()["id"]

    # Update title
    update_res = client.patch(f"/api/tasks/{task_id}", json={"title": "Обновленная задача"})
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Обновленная задача"

    # Delete
    del_res = client.delete(f"/api/tasks/{task_id}")
    assert del_res.status_code == 204

    # Verify 404
    get_res = client.get(f"/api/tasks/{task_id}")
    assert get_res.status_code == 404


def test_days_stats_and_summary(client):
    # Add tasks across two days
    client.post("/api/tasks", json={"title": "Задача 1", "date": "2026-09-01", "auto_start": False})
    client.post("/api/tasks", json={"title": "Задача 2", "date": "2026-09-02", "auto_start": False})
    client.post("/api/tasks", json={"title": "Задача 3", "date": "2026-09-02", "auto_start": False})

    # Get days stats
    stats_res = client.get("/api/days")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert len(stats) == 2

    # Get specific day summary
    summary_res = client.get("/api/days/2026-09-02/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["date"] == "2026-09-02"
    assert summary["task_count"] == 2


def test_export_csv(client):
    client.post("/api/tasks", json={"title": "Экспортная задача", "date": "2026-09-02", "category": "work", "auto_start": False})
    csv_res = client.get("/api/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Экспортная задача" in csv_res.text
    assert "Category" in csv_res.text
    assert "work" in csv_res.text


def test_task_categories_crud(client):
    # 1. Create with category
    res = client.post("/api/tasks", json={
        "title": "Учеба Python",
        "date": "2026-09-02",
        "category": "study",
        "auto_start": False
    })
    assert res.status_code == 201
    data = res.json()
    assert data["category"] == "study"
    task_id = data["id"]

    # 2. Update category
    patch_res = client.patch(f"/api/tasks/{task_id}", json={"category": "personal"})
    assert patch_res.status_code == 200
    assert patch_res.json()["category"] == "personal"


def test_duplicate_task_name_creates_interval_in_existing_task(client):
    # 1. Create initial task
    res1 = client.post("/api/tasks", json={
        "title": "Спортзал",
        "date": "2026-09-02",
        "category": "personal",
        "auto_start": True
    })
    assert res1.status_code == 201
    task1 = res1.json()
    task1_id = task1["id"]
    assert task1["is_active"] is True
    assert len(task1["intervals"]) == 1

    # 2. Pause the task
    client.post(f"/api/tasks/{task1_id}/pause")

    # 3. Create task with same name on same date (case-insensitive with whitespace)
    res2 = client.post("/api/tasks", json={
        "title": "  спортзал  ",
        "date": "2026-09-02",
        "category": "personal",
        "auto_start": True
    })
    assert res2.status_code == 200 or res2.status_code == 201
    task2 = res2.json()

    # Must be the exact same task ID
    assert task2["id"] == task1_id
    assert task2["is_active"] is True
    # Now has 2 intervals (1 completed, 1 active)
    assert len(task2["intervals"]) == 2

    # Check total tasks count on that day - must be still 1
    tasks_res = client.get("/api/tasks?date=2026-09-02")
    assert len(tasks_res.json()) == 1


def test_bulk_delete_tasks(client):
    # Create 3 tasks
    r1 = client.post("/api/tasks", json={"title": "T1", "date": "2026-09-02", "auto_start": False})
    r2 = client.post("/api/tasks", json={"title": "T2", "date": "2026-09-02", "auto_start": False})
    r3 = client.post("/api/tasks", json={"title": "T3", "date": "2026-09-02", "auto_start": False})
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]
    id3 = r3.json()["id"]

    # Bulk delete 2 tasks
    del_res = client.post("/api/tasks/bulk-delete", json={"task_ids": [id1, id3]})
    assert del_res.status_code == 204

    # Verify remaining tasks
    remaining = client.get("/api/tasks?date=2026-09-02").json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == id2

