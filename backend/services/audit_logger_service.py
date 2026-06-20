# FraudDetectAI/backend/services/audit_logger_service.py

from sqlalchemy.orm import Session
from database.audit_table import AuditLog

def log_action(db: Session, username: str, role: str, action: str, details: str = None, ip_address: str = None):
    """
    Saves a system action to the immutable audit log table.
    """
    new_log = AuditLog(
        username=username,
        role=role,
        action=action,
        details=details,
        ip_address=ip_address
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log