# FraudDetectAI/backend/schemas/login_schema.py

from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    # CHANGED: access_token -> token
    token: str
    token_type: str = "bearer"
    role: str
    username: str

    class Config:
        from_attributes = True