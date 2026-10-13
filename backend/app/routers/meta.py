from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import API_VERSION, CATEGORIES, DEFAULT_TZ
from app.database import get_db

router = APIRouter(prefix="/api", tags=["Meta"])


@router.get("/meta", response_model=schemas.MetaOut)
def get_meta():
    """API version, category taxonomy and default timezone for client scripts."""
    return schemas.MetaOut(
        api_version=API_VERSION,
        categories=[schemas.CategoryInfo(**c) for c in CATEGORIES],
        default_tz=DEFAULT_TZ,
    )


@router.get("/revision", response_model=schemas.RevisionOut)
def get_revision(db: Session = Depends(get_db)):
    """Opaque change stamp clients poll to keep the UI current across devices."""
    return schemas.RevisionOut(revision=crud.get_revision(db))
