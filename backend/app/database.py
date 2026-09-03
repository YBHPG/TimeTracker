from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

# SQLite specific connect args for multi-threading in FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    Base.metadata.create_all(bind=engine)
    # Ensure 'category' column exists in existing SQLite database
    try:
        with engine.connect() as conn:
            cursor = conn.execute(text("PRAGMA table_info(tasks)"))
            columns = [row[1] for row in cursor.fetchall()]
            if columns and "category" not in columns:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN category VARCHAR(50) DEFAULT 'work'"))
                conn.commit()
    except Exception:
        pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
