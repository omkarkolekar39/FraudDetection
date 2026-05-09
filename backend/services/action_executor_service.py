# FraudDetectAI/backend/services/action_executor_service.py

from sqlalchemy.orm import Session
from database.notification_table import Notification
from services.audit_logger_service import log_action
from services.persistence_service import save_business_action

def execute_business_action(db: Session, current_user, account_id: str, action_type: str):
    # Log the action for regulatory compliance
    log_action(
        db=db,
        username=current_user.username,
        role=current_user.role,
        action="Remediation Executed",
        details=f"Applied '{action_type}' to Account #{account_id}"
    )

    save_business_action(
        db=db,
        record_id=account_id,
        action_type=action_type,
        executed_by=current_user.username,
        executed_by_role=current_user.role,
        details=f"Applied '{action_type}' to Account #{account_id}",
    )

    # Create an internal system alert to signify the action was taken
    notif = Notification(
        target_role="All",
        message=f"Action '{action_type}' was applied to Account #{account_id} by {current_user.username}."
    )
    db.add(notif)
    db.commit()

    return f"Successfully applied '{action_type}' to Account #{account_id}."
