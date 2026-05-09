from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.db_config import get_db
from database.user_table import User
from services.login_service import get_current_user

router = APIRouter()


@router.get("/pending-users")
def get_pending_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Fetches all Analyst accounts awaiting Admin approval.
    """
    if current_user.role != "Admin":
        return []

    # Query for users where is_pending_approval is True
    pending = db.query(User).filter(User.is_pending_approval == True).all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "requestedRole": "Analyst",
            "date": u.created_at.isoformat() if u.created_at else None
        } for u in pending
    ]
