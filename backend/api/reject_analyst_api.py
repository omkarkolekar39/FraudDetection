from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config.db_config import get_db
from schemas.user_approval_schema import UserApprovalRequest
from services.reject_analyst_service import reject_analyst
from services.login_service import get_current_user

router = APIRouter()


@router.post("/reject-analyst")
def reject_user(
        payload: UserApprovalRequest,
        db: Session = Depends(get_db),
        admin_user=Depends(get_current_user)
):
    """
    POST /api/admin/reject-analyst
    Removes a pending registration request from the database.
    """
    # 1. Security Guard
    if admin_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Administrative clearance required.")

    # 2. Execute Rejection Logic via Service
    # (Assuming your service handles the deletion and any logging)
    result = reject_analyst(db, payload.username, admin_username=admin_user.username)

    if not result:
        raise HTTPException(status_code=404, detail="Pending request not found or already processed.")

    return {
        "status": "success",
        "message": f"Registration for {payload.username} has been rejected and removed."
    }