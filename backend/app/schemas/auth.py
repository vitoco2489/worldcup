from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
    is_admin: bool = False

    model_config = {"from_attributes": True}
