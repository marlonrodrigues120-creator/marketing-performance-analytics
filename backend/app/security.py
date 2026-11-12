"""Autenticação (JWT + bcrypt), RBAC e assinatura HMAC das chamadas app <-> n8n."""
import hashlib
import hmac
import time
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)
ROLE_LEVEL = {"viewer": 0, "analyst": 1, "admin": 2}
MAX_SKEW_SECONDS = 300  # janela anti-replay


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode(), hashed.encode())


def create_token(user: User) -> str:
    s = get_settings()
    payload = {"sub": str(user.id), "role": user.role, "exp": datetime.now(UTC) + timedelta(minutes=s.jwt_expires_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    try:
        data = jwt.decode(cred.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido ou expirado") from e
    user = db.get(User, data["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário inativo")
    return user


def require(role: str):
    """Dependência de RBAC: require('analyst') permite analyst e admin."""

    def dep(user: User = Depends(current_user)) -> User:
        if ROLE_LEVEL[user.role] < ROLE_LEVEL[role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permissão insuficiente")
        return user

    return dep


def sign(body: bytes, timestamp: str, secret: str) -> str:
    mac = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


async def verify_n8n_signature(request: Request, x_mpa_timestamp: str = Header(...), x_mpa_signature: str = Header(...)) -> bytes:
    """Valida callbacks do n8n: HMAC-SHA256 de "<timestamp>.<body>" + janela de tempo."""
    secret = get_settings().n8n_webhook_secret
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Integração n8n não configurada")
    try:
        ts = int(x_mpa_timestamp)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Timestamp inválido") from e
    if abs(time.time() - ts) > MAX_SKEW_SECONDS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Requisição expirada")
    body = await request.body()
    if not hmac.compare_digest(sign(body, x_mpa_timestamp, secret), x_mpa_signature):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Assinatura inválida")
    return body
