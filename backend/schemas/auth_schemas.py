from pydantic import BaseModel, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=72)
    role: str = Field(..., pattern="^(Admin|Analyst|Viewer)$")

class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserRegisterResponse(BaseModel):
    status: str
    message: str
    username: str
    role: str
    is_pending_approval: bool = False  # Default value prevents 500 errors if missing

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str