from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.db_config import get_db
from database.audit_table import AuditLog
from database.user_table import User
from services.login_service import get_current_user

router = APIRouter()

@router.get("/audit-logs")
def fetch_logs(limit: int = 50, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "Admin":
        return []

    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "username": l.username,
            "role": l.role,
            "action": l.action,
            "details": l.details,
            "timestamp": l.timestamp,
            "ip_address": l.ip_address,
        }
        for l in logs
    ]


@router.get("/system-summary")
def get_system_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "Admin":
        return {}

    total_users = db.query(User).count()
    admins = db.query(User).filter(User.role == "Admin").count()
    analysts = db.query(User).filter(User.role == "Analyst").count()
    viewers = db.query(User).filter(User.role == "Viewer").count()
    pending = db.query(User).filter(User.is_pending_approval == True).count()
    audit_events = db.query(AuditLog).count()

    return {
        "total_users": total_users,
        "admins": admins,
        "analysts": analysts,
        "viewers": viewers,
        "pending_requests": pending,
        "audit_events": audit_events,
    }
