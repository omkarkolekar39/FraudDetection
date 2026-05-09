from sqlalchemy import BigInteger, Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from config.db_config import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, index=True)
    target_username = Column(String, nullable=True) # Specific user
    target_role = Column(String, default="All")     # "Admin", "Analyst", or "All"
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
