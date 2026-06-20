import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "FraudDetectAI_Enterprise_Super_Secret_Key_2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))
except ValueError:
    ACCESS_TOKEN_EXPIRE_MINUTES = 120
