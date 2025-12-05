from fastapi import Header, HTTPException, Depends
import jwt, os
from typing import Annotated


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