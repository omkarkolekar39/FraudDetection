from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config.db_config import get_db
from database.notification_table import Notification
from database.user_table import User
from schemas.user_role_schema import UserRoleUpdateRequest
from services.audit_logger_service import log_action
from services.login_service import get_current_user

router = APIRouter()


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required.")

    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "is_pending_approval": user.is_pending_approval,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.patch("/users/{username}/role")
def update_user_role(
    username: str,
    payload: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required.")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.username == current_user.username and payload.role != "Admin":
        admin_count = db.query(User).filter(User.role == "Admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one Admin must remain in the system.",
            )

    previous_role = user.role
    user.role = payload.role
    user.is_pending_approval = False

    notification = Notification(
        target_username=user.username,
        target_role=user.role,
        message=f"Your platform role was updated from {previous_role} to {payload.role} by an Admin.",
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(user)

    log_action(
        db,
        current_user.username,
        current_user.role,
        "ROLE_UPDATED",
        f"Changed {user.username} from {previous_role} to {payload.role}",
    )

    return {
        "status": "success",
        "username": user.username,
        "role": user.role,
        "previous_role": previous_role,
    }
