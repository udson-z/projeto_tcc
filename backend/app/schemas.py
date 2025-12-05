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
    role: str  # USER | REGULATOR | FINANCIAL
    admin_secret: str


class PropertyCreate(BaseModel):
    matricula: str = Field(..., min_length=3, max_length=128)
    previous_owner: Optional[str] = Field(None, description="Wallet anterior (opcional)")
    current_owner: str = Field(..., min_length=3, description="Wallet atual")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class PropertyOut(PropertyCreate):
    id: int
    tx_hash: str

    class Config:
        from_attributes = True
