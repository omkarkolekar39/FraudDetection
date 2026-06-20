from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from config.db_config import get_db
from schemas.register_schema import RegisterRequest, RegisterResponse
from services.register_service import register_new_user
from database.notification_table import Notification

router = APIRouter()

@router.post("/register", response_model=RegisterResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = register_new_user(db, payload)

        IST = timezone(timedelta(hours=5, minutes=30))
        ist_now = datetime.now(IST)

        if user.role == "Analyst":
            new_notif = Notification(
                message=f"NEW ACCESS REQUEST: Operator {user.username} is awaiting Analyst clearance.",
                target_role="Admin",
                timestamp=ist_now,
                is_read=False
            )
            db.add(new_notif)
            db.commit()

        if user.is_pending_approval:
            message = f"Account created with Viewer access. Analyst clearance for {user.username} is pending Admin review."
        else:
            message = "Account Successfully Registered. You may now Log In."

        return {
            "status": "success",
            "message": message,
            "username": user.username,
            "role": user.role,
            "is_pending_approval": user.is_pending_approval
        }

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        print(f"Registration Error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal Error")
