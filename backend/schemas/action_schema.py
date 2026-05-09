# FraudDetectAI/backend/schemas/action_schema.py

from pydantic import BaseModel, Field

class ActionPayload(BaseModel):
    account_id: str
    action_type: str = Field(..., description="The remediation action, e.g., 'Block Account', 'Send Mock SMS'")