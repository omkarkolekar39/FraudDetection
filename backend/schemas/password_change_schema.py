# FraudDetectAI/backend/schemas/password_change_schema.py

from pydantic import BaseModel, Field

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, description="New password must be at least 6 characters long")