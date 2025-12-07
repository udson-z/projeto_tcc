import os
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException


JWT_SECRET = os.getenv("JWT_SECRET", "changeme")


async def get_current_role(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return data.get("role", "USER")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Retorna o payload JWT ou erro 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return data
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
