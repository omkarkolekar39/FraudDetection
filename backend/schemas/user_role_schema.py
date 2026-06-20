from pydantic import BaseModel, Field


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(Analyst|Viewer)$")
