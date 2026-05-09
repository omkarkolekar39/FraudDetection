from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from config.db_config import get_db
from schemas.login_schema import LoginRequest, TokenResponse
from services.login_service import authenticate_user

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    token_data = authenticate_user(db, payload.username, payload.password)
    if not token_data:
        # This triggers if authenticate_user returns None
        raise HTTPException(status_code=401, detail="Invalid Username or Password")
    return token_data