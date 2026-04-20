from google.auth.transport import requests
from google.oauth2 import id_token

from app.config import get_settings


def verify_google_id_token(token: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured")
    info = id_token.verify_oauth2_token(token, requests.Request(), settings.google_client_id)
    return info
