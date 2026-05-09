from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config.db_config import get_db
from schemas.action_schema import ActionPayload
from services.action_executor_service import execute_business_action
from services.login_service import get_current_user

router = APIRouter()


@router.post("/execute")
def trigger_action(payload: ActionPayload, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "Viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot execute actions.")

    result = execute_business_action(db, current_user, payload.account_id, payload.action_type)
    return {"status": "success", "message": result}