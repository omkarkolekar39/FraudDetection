from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config.db_config import get_db
from schemas.password_change_schema import PasswordChangeRequest
from services.login_service import get_current_user
from database.user_table import User
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.put("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    PUT /api/profile/change-password
    Verifies the old password and updates to the new one.
    """
    user = db.query(User).filter(User.username == current_user.username).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not pwd_context.verify(payload.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password.")

    user.hashed_password = pwd_context.hash(payload.new_password)
    db.commit()

    return {"status": "success", "message": "Password changed securely."}