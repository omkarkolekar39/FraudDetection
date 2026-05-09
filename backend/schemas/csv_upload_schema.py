from pydantic import BaseModel
from typing import List

class CSVMetadataResponse(BaseModel):
    status: str
    total_records: int
    total_columns: int
    column_names: List[str]
    filename: str

    class Config:
        from_attributes = True