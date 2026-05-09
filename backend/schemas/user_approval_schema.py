# FraudDetectAI/backend/schemas/user_approval_schema.py

from pydantic import BaseModel

class UserApprovalRequest(BaseModel):
    username: str  # The username of the pending Analyst