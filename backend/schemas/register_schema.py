# FraudDetectAI/backend/schemas/register_schema.py
from pydantic import BaseModel, Field
from typing import Optional

class RegisterRequest(BaseModel):
    # Field(...) means the field is required
    username: str = Field(..., min_length=3, description="Username must be at least 3 characters")
    password: str = Field(..., min_length=6, max_length=72, description="Bcrypt limit is 72 bytes")
    role: str = Field(..., pattern="^(Admin|Analyst|Viewer)$", description="Role must be Admin, Analyst, or Viewer")

class RegisterResponse(BaseModel):
    status: str
    message: str
    username: str
    role: str
    is_pending_approval: bool

    # ADD THIS: Optional token so the user can log in immediately
    token: Optional[str] = None