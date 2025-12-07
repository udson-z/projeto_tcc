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


class ProposalCreate(BaseModel):
    matricula: str = Field(..., min_length=3, max_length=128)
    amount: float = Field(..., gt=0, description="Valor ofertado em moeda fiat ou ETH (mock).")
    fraction: Optional[float] = Field(
        None, ge=0.01, le=100, description="Percentual da fração desejada (0.01 a 100)."
    )
    message: Optional[str] = Field(None, max_length=512)


class ProposalOut(ProposalCreate):
    id: int
    owner_wallet: str
    proposer_wallet: str
    status: str

    class Config:
        from_attributes = True


class ProposalDecisionIn(BaseModel):
    decision: str = Field(..., description="ACCEPT ou REJECT")


class TransferOut(BaseModel):
    id: int
    proposal_id: int
    matricula: str
    owner_wallet: str
    buyer_wallet: str
    owner_signed: bool
    buyer_signed: bool
    regulator_signed: bool
    financial_signed: bool
    status: str
    tx_hash: Optional[str] = None

    class Config:
        from_attributes = True


class TransferActionIn(BaseModel):
    action: str = Field(..., description="SIGN ou REJECT")


class PosValidationIn(BaseModel):
    tx_reference: str = Field(..., description="Identificador da transação a validar")
    force_invalid: bool = Field(False, description="Simula rejeição para testes")


class PosValidationOut(BaseModel):
    id: int
    tx_reference: str
    status: str
    approvals: int
    required: int
    selected_validators: list[str]
    tx_hash: Optional[str] = None

    class Config:
        from_attributes = True


class ProposalAudit(BaseModel):
    id: int
    proposer_wallet: str
    owner_wallet: str
    amount: float
    fraction: Optional[float] = None
    status: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class TransferAudit(BaseModel):
    id: int
    proposal_id: int
    matricula: str
    owner_wallet: str
    buyer_wallet: str
    status: str
    tx_hash: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AuditOut(BaseModel):
    matricula: str
    current_owner: str
    previous_owner: Optional[str] = None
    tx_hash: Optional[str] = None
    proposals: list[ProposalAudit]
    transfers: list[TransferAudit]
