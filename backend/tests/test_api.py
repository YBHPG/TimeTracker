import csv
import io
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
from app import config

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


def test_offline_sync_timestamps_and_client_ids(client):
    # 1. Create task with client-generated UUID and specific start time
    custom_task_id = "client-task-uuid-12345"
    t_start = "2026-09-04T10:00:00Z"
    t_pause1 = "2026-09-04T10:20:00Z"

    res = client.post("/api/tasks", json={
        "id": custom_task_id,
        "title": "Офлайн задача 1",
        "date": "2026-09-04",
        "category": "work",
        "auto_start": True,
        "at": t_start
    })
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == custom_task_id
    assert data["is_active"] is True
    assert len(data["intervals"]) == 1
    assert data["intervals"][0]["start_time"].startswith("2026-09-04T10:00:00")

    # 2. Pause task with specific offline timestamp
    pause_res = client.post(f"/api/tasks/{custom_task_id}/pause", json={"at": t_pause1})
    assert pause_res.status_code == 200
    p_data = pause_res.json()
    assert p_data["is_active"] is False
    assert p_data["intervals"][0]["duration_seconds"] == 1200
    assert p_data["total_duration_seconds"] == 1200

    # 3. Create second task with client UUID and start with custom interval ID and timestamp
    custom_task_id2 = "client-task-uuid-67890"
    custom_inv_id2 = "client-inv-uuid-abcde"
    t_start2 = "2026-09-04T10:20:00Z"
    t_pause2 = "2026-09-04T10:50:00Z"

    res2 = client.post("/api/tasks", json={
        "id": custom_task_id2,
        "title": "Офлайн задача 2",
        "date": "2026-09-04",
        "category": "study",
        "auto_start": False,
    })
    assert res2.status_code == 201
    assert res2.json()["id"] == custom_task_id2

    # Start with custom interval ID and timestamp
    start_res = client.post(f"/api/tasks/{custom_task_id2}/start", json={
        "at": t_start2,
        "interval_id": custom_inv_id2
    })
    assert start_res.status_code == 200
    s_data = start_res.json()
    assert s_data["is_active"] is True
    assert s_data["intervals"][0]["id"] == custom_inv_id2
    assert s_data["intervals"][0]["start_time"].startswith("2026-09-04T10:20:00")

    # Pause second task
    pause_res2 = client.post(f"/api/tasks/{custom_task_id2}/pause", json={"at": t_pause2})
    assert pause_res2.status_code == 200
    p2_data = pause_res2.json()
    assert p2_data["is_active"] is False
    assert p2_data["intervals"][0]["duration_seconds"] == 1800  # 30 min

    # 4. Add interval with client UUID
    custom_manual_inv_id = "client-manual-inv-111"
    inv_res = client.post(f"/api/tasks/{custom_task_id2}/intervals", json={
        "id": custom_manual_inv_id,
        "start_time": "2026-09-04T11:00:00Z",
        "end_time": "2026-09-04T11:15:00Z"
    })
    assert inv_res.status_code == 201
    assert inv_res.json()["id"] == custom_manual_inv_id
    assert inv_res.json()["duration_seconds"] == 900


# --- Analytics: /api/summary, /api/entries, /api/meta, read token ---


def _seed_interval(client, title, date_str, start_iso, end_iso, category="work"):
    res = client.post("/api/tasks", json={
        "title": title,
        "date": date_str,
        "category": category,
        "auto_start": False,
    })
    assert res.status_code == 201
    task_id = res.json()["id"]
    inv = client.post(f"/api/tasks/{task_id}/intervals", json={
        "start_time": start_iso,
        "end_time": end_iso,
    })
    assert inv.status_code == 201
    return task_id


def test_summary_single_day_matches_day_summary(client):
    _seed_interval(client, "Отчёт", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T06:30:00Z")

    summary = client.get("/api/summary?from=2026-09-12&to=2026-09-12").json()
    day = client.get("/api/days/2026-09-12/summary").json()

    assert summary["total_seconds"] == day["total_seconds"] == 9000


def test_summary_parts_sum_to_total(client):
    _seed_interval(client, "A", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T06:00:00Z")
    _seed_interval(client, "B", "2026-09-13", "2026-09-13T04:00:00Z", "2026-09-13T05:00:00Z")

    data = client.get("/api/summary?from=2026-09-12&to=2026-09-13").json()

    assert data["total_seconds"] == 10800
    assert sum(d["total_seconds"] for d in data["days"]) == data["total_seconds"]
    assert sum(t["total_seconds"] for t in data["tasks"]) == data["total_seconds"]
    assert sum(c["total_seconds"] for c in data["categories"]) == data["total_seconds"]


def test_summary_compare_previous_period(client):
    _seed_interval(client, "Prev", "2026-09-07", "2026-09-07T04:00:00Z", "2026-09-07T05:06:40Z")  # 4000s
    _seed_interval(client, "Cur", "2026-09-10", "2026-09-10T04:00:00Z", "2026-09-10T05:23:20Z")  # 5000s

    data = client.get("/api/summary?from=2026-09-10&to=2026-09-12&compare=true").json()

    assert data["total_seconds"] == 5000
    assert data["compare"]["from"] == "2026-09-07"
    assert data["compare"]["to"] == "2026-09-09"
    assert data["compare"]["total_seconds"] == 4000
    assert data["compare"]["delta_seconds"] == 1000
    assert data["compare"]["delta_percent"] == 25.0


def test_summary_counts_running_interval(client):
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=30)
    date_str = now.date().isoformat()
    res = client.post("/api/tasks", json={
        "title": "Running",
        "date": date_str,
        "auto_start": True,
        "at": start.isoformat(),
    })
    assert res.status_code == 201

    data = client.get(f"/api/summary?from={date_str}&to={date_str}").json()
    assert data["has_running"] is True
    assert data["running_seconds"] >= 1700
    assert data["total_seconds"] >= 1700


def test_summary_empty_range_returns_zeros(client):
    res = client.get("/api/summary?from=2026-01-01&to=2026-01-05")
    assert res.status_code == 200
    data = res.json()
    assert data["total_seconds"] == 0
    assert data["days"] == []
    assert data["tasks"] == []
    assert data["categories"] == []


def test_summary_bad_inputs(client):
    assert client.get("/api/summary?from=2026-13-40&to=2026-13-41").status_code == 422
    assert client.get("/api/summary?from=2026-09-01&to=2026-09-02&tz=Nope/Nope").status_code == 400
    assert client.get("/api/summary?from=2026-09-10&to=2026-09-01").status_code == 400
    assert client.get("/api/summary").status_code == 400


def test_summary_month_period_boundaries(client):
    res = client.get("/api/summary?period=month&anchor=2026-09-15&tz=Asia/Almaty")
    assert res.status_code == 200
    data = res.json()
    assert data["from"] == "2026-09-01"
    assert data["to"] == "2026-09-30"


def test_entries_matches_csv(client):
    _seed_interval(client, "Отчёт", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T06:30:00Z")
    _seed_interval(client, "Созвон", "2026-09-12", "2026-09-12T07:00:00Z", "2026-09-12T07:30:00Z")

    entries = client.get("/api/entries?from=2026-09-12&to=2026-09-12").json()
    entries_total = sum(e["duration_seconds"] for e in entries["entries"])

    csv_res = client.get("/api/export/csv?date_from=2026-09-12&date_to=2026-09-12")
    reader = csv.reader(io.StringIO(csv_res.text))
    next(reader)  # skip header
    csv_total = 0
    csv_rows = 0
    for row in reader:
        if row[4]:  # non-empty Interval ID
            csv_rows += 1
            csv_total += int(row[7])

    assert entries["count"] == csv_rows
    assert entries_total == csv_total == 10800


def test_meta_endpoint(client):
    res = client.get("/api/meta")
    assert res.status_code == 200
    data = res.json()
    assert data["api_version"] == config.API_VERSION
    assert data["default_tz"] == config.DEFAULT_TZ
    assert [c["id"] for c in data["categories"]] == ["work", "personal", "study"]


def test_read_token_guard(client, monkeypatch):
    monkeypatch.setattr(config, "READ_TOKEN", "secret")
    _seed_interval(client, "Данные", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T05:00:00Z")

    # Protected read: no token -> 401, correct token -> 200
    assert client.get("/api/summary?from=2026-09-12&to=2026-09-12").status_code == 401
    ok = client.get(
        "/api/summary?from=2026-09-12&to=2026-09-12",
        headers={"Authorization": "Bearer secret"},
    )
    assert ok.status_code == 200
    assert ok.headers["X-Tracker-Version"] == config.API_VERSION

    # Health is always open
    assert client.get("/api/health").status_code == 200

    # UI endpoints stay open (no token required)
    assert client.get("/api/tasks?date=2026-09-12").status_code == 200

    # Read token must not be accepted for writes
    assert client.post(
        "/api/tasks",
        json={"title": "Nope", "date": "2026-09-12", "auto_start": False},
        headers={"Authorization": "Bearer secret"},
    ).status_code == 403


def test_summary_merges_cyrillic_titles_case_insensitive(client):
    _seed_interval(client, "Отчёт", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T05:00:00Z")
    _seed_interval(client, "ОТЧЁТ", "2026-09-13", "2026-09-13T04:00:00Z", "2026-09-13T04:30:00Z")

    data = client.get("/api/summary?from=2026-09-12&to=2026-09-13").json()
    assert len(data["tasks"]) == 1
    assert data["tasks"][0]["total_seconds"] == 5400
    assert data["tasks"][0]["day_count"] == 2


def test_entries_task_filter_cyrillic_case_insensitive(client):
    _seed_interval(client, "Отчёт Гознак", "2026-09-12", "2026-09-12T04:00:00Z", "2026-09-12T06:30:00Z")

    data = client.get("/api/entries", params={"from": "2026-09-12", "to": "2026-09-12", "task": "отч"}).json()
    assert data["count"] == 1
    assert data["entries"][0]["task_title"] == "Отчёт Гознак"


def test_invalid_category_rejected(client):
    res = client.post("/api/tasks", json={
        "title": "Bad cat",
        "date": "2026-09-12",
        "category": "other",
        "auto_start": False,
    })
    assert res.status_code == 422


