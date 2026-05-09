from fastapi import APIRouter, Request, HTTPException, Depends
from services.login_service import get_current_user

router = APIRouter()


@router.post("/thresholds")
async def set_risk_thresholds(
        request: Request,
        current_user=Depends(get_current_user)
):
    try:
        payload = await request.json()

        # support both old and current frontend keys
        high = payload.get("high") or payload.get("highThreshold")
        medium = payload.get("medium") or payload.get("midThreshold")

        if high is None or medium is None:
            raise HTTPException(status_code=400, detail="Threshold payload incomplete.")

        request.app.state.thresholds = {
            "high": float(high),
            "medium": float(medium)
        }

        return {
            "status": "success",
            "message": f"Thresholds synced: High {float(high)}%, Medium {float(medium)}%"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Threshold update failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
