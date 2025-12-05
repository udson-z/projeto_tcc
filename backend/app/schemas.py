from pydantic import BaseModel, Field
from typing import Optional


class StartSiweOut(BaseModel):
    nonce: str


class VerifySiweIn(BaseModel):
    address: str = Field(..., description="Wallet address (0x…)")
    message: str = Field(..., description="Signed message text")
    signature: str = Field(..., description="Signature 0x…")


class TokenOut(BaseModel):
    token: str
    role: str


class AssignRoleIn(BaseModel):
    wallet: str
    role: str # USER | REGULATOR | FINANCIAL
    admin_secret: str