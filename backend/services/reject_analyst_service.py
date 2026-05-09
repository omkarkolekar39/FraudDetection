# FraudDetectAI/backend/services/reject_analyst_service.py

from sqlalchemy.orm import Session
from database.user_table import User
from services.audit_logger_service import log_action


def reject_analyst(db: Session, target_username: str, admin_username: str):
    user = db.query(User).filter(User.username == target_username, User.is_pending_approval == True).first()
    if not user:
        return False

    # Delete the rejected request entirely
    db.delete(user)

    log_action(db, admin_username, "Admin", "Rejected User", f"Denied access to {target_username}")
    db.commit()
    return True