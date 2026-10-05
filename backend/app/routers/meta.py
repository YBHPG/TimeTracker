from fastapi import APIRouter

from app import schemas
from app.config import API_VERSION, CATEGORIES, DEFAULT_TZ

router = APIRouter(prefix="/api", tags=["Meta"])


@router.get("/meta", response_model=schemas.MetaOut)
def get_meta():
    """API version, category taxonomy and default timezone for client scripts."""
    return schemas.MetaOut(
        api_version=API_VERSION,
        categories=[schemas.CategoryInfo(**c) for c in CATEGORIES],
        default_tz=DEFAULT_TZ,
    )
