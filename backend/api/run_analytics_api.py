from fastapi import APIRouter, Depends, Request, HTTPException
from services.analytics_runner_service import execute_ml_pipeline
from services.login_service import get_current_user

router = APIRouter()

@router.post("/run-pipeline/")
async def run_pipeline(request: Request, user=Depends(get_current_user)):
    if getattr(request.app.state, 'raw_df', None) is None:
        raise HTTPException(status_code=400, detail="Neural Buffer empty. Upload CSV first.")

    try:
        results = execute_ml_pipeline(request, None, user.username)
        return {
            "status": "success",
            "metadata": {
                "total": results["processed_records"],
                "high": results["high_risk_found"],
                "medium": results["medium_risk_found"]
            }
        }
    except Exception as e:
        print(f"PIPELINE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
