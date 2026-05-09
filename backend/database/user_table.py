from sqlalchemy import BigInteger, Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from config.db_config import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Viewer", nullable=False)
    is_pending_approval = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
