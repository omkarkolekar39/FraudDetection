from typing import Any

from pydantic import BaseModel, Field


class LiveStreamRowRequest(BaseModel):
    row_data: dict[str, Any] = Field(..., description="One incoming dataset row keyed by column name.")
    source: str = Field(default="manual-ui", max_length=100)
