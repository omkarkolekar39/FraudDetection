# FraudDetectAI/backend/services/approve_analyst_service.py

from sqlalchemy.orm import Session
from database.user_table import User
from database.notification_table import Notification
from services.audit_logger_service import log_action


def approve_analyst(db: Session, target_username: str, admin_username: str):
    user = db.query(User).filter(User.username == target_username, User.is_pending_approval == True).first()
    if not user:
        return False

    user.role = "Analyst"
    user.is_pending_approval = False

    # Notify the user they were approved
    notif = Notification(
        target_username=user.username,
        message="Your account has been approved. You are now a Risk Analyst."
    )
    db.add(notif)

    log_action(db, admin_username, "Admin", "Approved User", f"Granted Analyst access to {target_username}")
    db.commit()
    return True