# FraudDetectAI/backend/schemas/threshold_schema.py

from pydantic import BaseModel, Field

class ThresholdRequest(BaseModel):
    medium_risk: int = Field(..., ge=1, le=99, description="Minimum threshold for Medium Risk (Yellow)")
    high_risk: int = Field(..., ge=2, le=100, description="Minimum threshold for High Risk (Red)")