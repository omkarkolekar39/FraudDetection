from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from config.db_config import get_db
from services.login_service import get_current_user
import pandas as pd
import numpy as np
from services.persistence_service import hydrate_runtime_state

router = APIRouter()


@router.get("/")
async def get_risk_directory(
        request: Request,
        db: Session = Depends(get_db),
        risk_tier: str = "High",
        offset: int = 0,
        limit: int = 100,
        current_user=Depends(get_current_user)
):
    if (
        getattr(request.app.state, 'raw_df', None) is None
        and not getattr(request.app.state, 'categories', [])
    ):
        hydrate_runtime_state(request, db)

    df = getattr(request.app.state, 'raw_df', None)
    categories = getattr(request.app.state, 'categories', [])
    scores = getattr(request.app.state, 'scores', [])

    # 2. Buffer Integrity Check
    if len(categories) == 0:
        return {
            "status": "waiting",
            "message": "Neural Buffer is empty. Please execute ML Pipeline.",
            "data": []
        }

    try:
        if df is not None:
            df_display = df.copy()
            df_display['row_num'] = range(1, len(df) + 1)
        else:
            df_display = pd.DataFrame({"row_num": range(1, len(categories) + 1)})

        df_display['record_id'] = [f"RECORD {index}" for index in range(1, len(df_display) + 1)]
        df_display['risk_score'] = scores
        df_display['category'] = categories

        target = risk_tier.strip().lower()

        filtered_df = df_display[
            df_display['category'].astype(str).str.lower().str.contains(target)
        ].copy()

        filtered_df = filtered_df.replace([np.inf, -np.inf], np.nan)
        filtered_df = filtered_df.fillna("")

        safe_offset = max(0, offset)
        safe_limit = max(1, min(limit, 100))
        total_count = len(filtered_df)
        paged_df = filtered_df.iloc[safe_offset:safe_offset + safe_limit]
        directory_data = paged_df.to_dict(orient="records")

        return {
            "status": "success",
            "tier_requested": risk_tier,
            "offset": safe_offset,
            "limit": safe_limit,
            "total_count": total_count,
            "count": len(directory_data),
            "has_more": safe_offset + len(directory_data) < total_count,
            "data": directory_data
        }

    except Exception as e:
        print(f"Risk directory failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to slice data buffer.")
