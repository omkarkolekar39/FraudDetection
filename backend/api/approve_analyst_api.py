from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime
from config.db_config import get_db
from database.user_table import User
from database.notification_table import Notification
from schemas.user_approval_schema import UserApprovalRequest
from services.login_service import get_current_user

router = APIRouter()


@router.post("/approve-analyst")
def approve_analyst(
        payload: UserApprovalRequest,
        db: Session = Depends(get_db),
        admin_user=Depends(get_current_user)
):
    if not admin_user or admin_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required for clearance granting."
        )

    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        user.role = "Analyst"
        user.is_pending_approval = False

        new_notif = Notification(
            target_username=payload.username,
            target_role="Analyst",
            message="Your clearance level has been upgraded to Analyst. ML Pipeline access is now active.",
            is_read=False,
            timestamp=datetime.now()
        )

        db.add(new_notif)
        db.commit()

        return {
            "status": "success",
            "message": f"Successfully granted Analyst privileges to {payload.username}."
        }

    except Exception as e:
        db.rollback()
        print(f"Analyst approval failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database transaction failed: {str(e)}"
        )
