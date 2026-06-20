from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from database.user_table import User
from database.notification_table import Notification
from schemas.register_schema import RegisterRequest
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def register_new_user(db: Session, payload: RegisterRequest):
    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        raise ValueError("Operator ID is already registered in the system.")

    if payload.role == "Admin":
        admin_exists = db.query(User).filter(User.role == "Admin").first()
        if admin_exists:
            raise ValueError("Access Denied: A Master Administrator is already active.")

    hashed_pw = pwd_context.hash(payload.password)
    assigned_role = payload.role
    is_pending = False

    if payload.role == "Analyst":
        assigned_role = "Viewer"
        is_pending = True
        IST = timezone(timedelta(hours=5, minutes=30))
        ist_now = datetime.now(IST)

        admin_notif = Notification(
            target_role="Admin",
            message=f"Clearance Request: {payload.username} is requesting Analyst status.",
            timestamp=ist_now,
            is_read=False
        )
        db.add(admin_notif)

    new_user = User(
        username=payload.username,
        hashed_password=hashed_pw,
        role=assigned_role,
        is_pending_approval=is_pending
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        print(f"User registration failed: {e}")
        raise RuntimeError("System error: Could not write to the security ledger.")

    new_user.requested_role = payload.role

    return new_user
