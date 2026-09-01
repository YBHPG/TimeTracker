from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import STATIC_DIR
from app.database import engine, Base, init_db
from app.routers import tasks, days, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup
    init_db()
    yield


app = FastAPI(
    title="TimeTracker API",
    description="REST API для простого учета времени на задачи в течение дня",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(tasks.router)
app.include_router(days.router)
app.include_router(export.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "TimeTracker API"}


# Serve frontend static assets if built
if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Mount assets folder if present
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Serve index.html for root and SPA client routes
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        # If static file exists directly in static dir (e.g. favicon.ico, manifest.json)
        file_path = STATIC_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        # Default SPA fallback
        return FileResponse(STATIC_DIR / "index.html")
