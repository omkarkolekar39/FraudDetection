import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = (
    os.getenv("SUPABASE_DB_URL")
    or os.getenv("DATABASE_URL")
)

if not DATABASE_URL:
    raise RuntimeError(
        "Supabase database URL is required. Set SUPABASE_DB_URL to your Supabase Postgres connection string."
    )

database_url = make_url(DATABASE_URL)

if database_url.drivername.startswith("sqlite"):
    raise RuntimeError("SQLite is disabled for this project. Configure Supabase Postgres with SUPABASE_DB_URL.")

if not database_url.drivername.startswith("postgresql"):
    raise RuntimeError("Only Supabase/Postgres database URLs are supported by this project.")

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

if database_url.get_backend_name() == "postgresql" and "sslmode" not in database_url.query:
    engine_kwargs["connect_args"] = {"sslmode": os.getenv("DB_SSLMODE", "require")}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI Dependency to yield a database session per request.
    Ensures the connection is safely closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
