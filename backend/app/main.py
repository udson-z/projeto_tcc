import json
import os
import random
import secrets

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import generate_nonce, issue_jwt, verify_signature
from app.blockchain import register_property_onchain
from app.database import Base, engine, get_db
from app.deps import get_current_user
from app.models import (
    Nonce,
    Property,
    Proposal,
    ProposalStatus,
    Role,
    Transfer,
    TransferStatus,
    User,
    PosValidation,
    PosStatus,
)
from app.schemas import (
    AssignRoleIn,
    PropertyCreate,
    PropertyOut,
    ProposalCreate,
    ProposalOut,
    ProposalDecisionIn,
    PosValidationIn,
    PosValidationOut,
    AuditOut,
    TransferAudit,
    TransferActionIn,
    TransferOut,
    TokenOut,
    VerifySiweIn,
)


app = FastAPI(title="POC ID1 – Auth by Wallet")

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Garante criação das tabelas em ambiente simples.
Base.metadata.create_all(bind=engine)


DEFAULT_VALIDATORS = [
    {"address": "0xvalidator1", "stake": 1_000},
    {"address": "0xvalidator2", "stake": 750},
    {"address": "0xvalidator3", "stake": 500},
    {"address": "0xvalidator4", "stake": 250},
]


def _get_validators():
    """Retorna validadores configurados (JSON em POS_VALIDATORS) ou default."""
    env_vals = os.getenv("POS_VALIDATORS")
    if env_vals:
        try:
            data = json.loads(env_vals)
            if isinstance(data, list) and data:
                return data
        except Exception:
            pass
    return DEFAULT_VALIDATORS


def _select_validators(count: int = 3):
    validators = _get_validators()
    validators = sorted(validators, key=lambda v: v.get("stake", 0), reverse=True)
    return validators[: min(count, len(validators))]


def _run_pos_validation(tx_reference: str, force_invalid: bool = False):
    selected = _select_validators()
    approvals = 0 if force_invalid else len(selected)
    required = len(selected)
    status = PosStatus.VALIDATED if approvals >= required else PosStatus.REJECTED
    tx_hash = f"pos-mock-{secrets.token_hex(8)}" if status == PosStatus.VALIDATED else None
    return selected, approvals, required, status, tx_hash


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/siwe/start")
def start_siwe(db: Session = Depends(get_db)):
    nonce = generate_nonce(db)
    return {"nonce": nonce}


@app.post("/auth/siwe/verify", response_model=TokenOut)
def verify_siwe(payload: VerifySiweIn, db: Session = Depends(get_db)):
    # Verifica se nonce existe (opcional: expirar/consumir)
    n = (
        db.query(Nonce)
        .filter(Nonce.nonce == payload.message.split("Nonce: ")[-1].split("\n")[0])
        .first()
    )
    if not n:
        raise HTTPException(status_code=400, detail="Invalid nonce")

    ok = verify_signature(payload.address, payload.message, payload.signature)
    if not ok:
        raise HTTPException(status_code=401, detail="Signature mismatch")

    user = db.query(User).filter(User.wallet == payload.address.lower()).first()
    if not user:
        user = User(wallet=payload.address.lower(), role=Role.USER)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = issue_jwt(user)
    return {"token": token, "role": user.role.value}


@app.post("/admin/assign-role")
def assign_role(body: AssignRoleIn, db: Session = Depends(get_db)):
    if body.admin_secret != os.getenv("ADMIN_SECRET", "changeme-admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        role = Role(body.role)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role")

    w = body.wallet.lower()
    user = db.query(User).filter(User.wallet == w).first()
    if not user:
        user = User(wallet=w, role=role)
        db.add(user)
    else:
        user.role = role
    db.commit()
    return {"wallet": w, "role": role.value}


@app.post("/properties", response_model=PropertyOut)
def register_property(
    payload: PropertyCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Garante unicidade de matrícula
    existing = db.query(Property).filter(Property.matricula == payload.matricula).first()
    if existing:
        raise HTTPException(status_code=409, detail="Matrícula já registrada")

    try:
        tx_hash = register_property_onchain(
            matricula=payload.matricula,
            previous_owner=payload.previous_owner,
            current_owner=payload.current_owner,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao registrar no contrato: {exc}")

    prop = Property(
        matricula=payload.matricula,
        previous_owner=payload.previous_owner,
        current_owner=payload.current_owner,
        latitude=payload.latitude,
        longitude=payload.longitude,
        tx_hash=tx_hash,
        created_by=user.get("sub"),
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@app.post("/proposals", response_model=ProposalOut)
def create_proposal(
    payload: ProposalCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra proposta de compra/divisão e notifica o proprietário (mock)."""
    prop = db.query(Property).filter(Property.matricula == payload.matricula).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")

    proposal = Proposal(
        matricula=payload.matricula,
        proposer_wallet=user.get("sub"),
        owner_wallet=prop.current_owner,
        amount=payload.amount,
        fraction=payload.fraction,
        message=payload.message,
        status=ProposalStatus.PENDING,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    # Mock de notificação
    print(
        f"[notificacao] Proposta {proposal.id} registrada para {prop.current_owner} "
        f"(matrícula {proposal.matricula})"
    )

    return proposal


@app.post("/proposals/{proposal_id}/decision", response_model=ProposalOut)
def decide_proposal(
    proposal_id: int,
    payload: ProposalDecisionIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permite ao proprietário aceitar ou rejeitar proposta."""
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")

    wallet = (user.get("sub") or "").lower()
    if wallet != proposal.owner_wallet.lower():
        raise HTTPException(status_code=403, detail="Apenas o proprietário pode decidir")

    if proposal.status != ProposalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Proposta já decidida")

    decision = payload.decision.upper()
    if decision == "ACCEPT":
        proposal.status = ProposalStatus.ACCEPTED
    elif decision == "REJECT":
        proposal.status = ProposalStatus.REJECTED
    else:
        raise HTTPException(status_code=400, detail="Decision deve ser ACCEPT ou REJECT")

    db.commit()
    db.refresh(proposal)

    print(
        f"[notificacao] Proposta {proposal.id} {proposal.status.value} para comprador "
        f"{proposal.proposer_wallet}"
    )

    return proposal


@app.post("/transfers/{proposal_id}/initiate", response_model=TransferOut)
def initiate_transfer(
    proposal_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria um fluxo de multiassinatura para transferência com base em proposta aceita."""
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    if proposal.status != ProposalStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Proposta precisa estar ACCEPTED")

    wallet = (user.get("sub") or "").lower()
    if wallet != proposal.owner_wallet.lower():
        raise HTTPException(status_code=403, detail="Somente o proprietário inicia a transferência")

    existing = db.query(Transfer).filter(Transfer.proposal_id == proposal_id).first()
    if existing:
        return existing

    transfer = Transfer(
        proposal_id=proposal.id,
        matricula=proposal.matricula,
        owner_wallet=proposal.owner_wallet.lower(),
        buyer_wallet=proposal.proposer_wallet.lower(),
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


@app.post("/transfers/{proposal_id}/sign", response_model=TransferOut)
def sign_transfer(
    proposal_id: int,
    payload: TransferActionIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Coleta assinaturas: proprietário, comprador, regulador, agente financeiro."""
    transfer = db.query(Transfer).filter(Transfer.proposal_id == proposal_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferência não encontrada")
    if transfer.status != TransferStatus.PENDING:
        raise HTTPException(status_code=400, detail="Transferência já decidida")

    wallet = (user.get("sub") or "").lower()
    role = user.get("role", "USER")
    action = payload.action.upper()
    if action not in {"SIGN", "REJECT"}:
        raise HTTPException(status_code=400, detail="Action deve ser SIGN ou REJECT")

    # Identifica tipo de assinatura
    if wallet == transfer.owner_wallet.lower():
        transfer.owner_signed = action == "SIGN"
    elif wallet == transfer.buyer_wallet.lower():
        transfer.buyer_signed = action == "SIGN"
    elif role == Role.REGULATOR.value:
        transfer.regulator_signed = action == "SIGN"
    elif role == Role.FINANCIAL.value:
        transfer.financial_signed = action == "SIGN"
    else:
        raise HTTPException(status_code=403, detail="Sem permissão para assinar")

    if action == "REJECT":
        transfer.status = TransferStatus.REJECTED
        db.commit()
        db.refresh(transfer)
        print(f"[notificacao] Transferência rejeitada por {wallet}")
        return transfer

    # Verifica se todas as assinaturas foram coletadas
    if (
        transfer.owner_signed
        and transfer.buyer_signed
        and transfer.regulator_signed
        and transfer.financial_signed
    ):
        # Executa a transferência on-chain (mockável)
        prop = db.query(Property).filter(Property.matricula == transfer.matricula).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Propriedade não encontrada")
        try:
            tx_hash = register_property_onchain(
                matricula=transfer.matricula,
                previous_owner=prop.current_owner,
                current_owner=transfer.buyer_wallet,
                latitude=prop.latitude,
                longitude=prop.longitude,
            )
            transfer.tx_hash = tx_hash
            transfer.status = TransferStatus.EXECUTED
            # Atualiza propriedade para refletir transferência.
            prop.previous_owner = prop.current_owner
            prop.current_owner = transfer.buyer_wallet
            prop.tx_hash = tx_hash
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Falha ao executar transferência: {exc}")

    db.commit()
    db.refresh(transfer)
    if transfer.status == TransferStatus.EXECUTED:
        print(
            f"[notificacao] Transferência executada para {transfer.matricula} tx={transfer.tx_hash}"
        )
    return transfer


@app.post("/pos/validate", response_model=PosValidationOut)
def validate_pos(
    payload: PosValidationIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Simula validação PoS selecionando validadores por stake."""
    role = user.get("role", "USER")
    if role not in {Role.REGULATOR.value, Role.FINANCIAL.value}:
        raise HTTPException(status_code=403, detail="Apenas administradores podem validar")

    selected, approvals, required, status, tx_hash = _run_pos_validation(
        payload.tx_reference, payload.force_invalid
    )
    addresses = [v.get("address") for v in selected]

    record = PosValidation(
        tx_reference=payload.tx_reference,
        selected_validators=json.dumps(addresses),
        approvals=approvals,
        required=required,
        status=status,
        tx_hash=tx_hash,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    print(
        f"[pos] tx {record.tx_reference} status={record.status.value} "
        f"validadores={addresses} approvals={approvals}/{required}"
    )

    return {
        "id": record.id,
        "tx_reference": record.tx_reference,
        "status": record.status.value,
        "approvals": record.approvals,
        "required": record.required,
        "selected_validators": addresses,
        "tx_hash": record.tx_hash,
    }


@app.get("/audit/{matricula}", response_model=AuditOut)
def audit_history(
    matricula: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna histórico auditável para regulador."""
    role = user.get("role", "USER")
    if role != Role.REGULATOR.value:
        raise HTTPException(status_code=403, detail="Apenas regulador pode consultar histórico")

    prop = db.query(Property).filter(Property.matricula == matricula).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")

    proposals = (
        db.query(Proposal)
        .filter(Proposal.matricula == matricula)
        .order_by(Proposal.created_at.asc())
        .all()
    )
    transfers = (
        db.query(Transfer)
        .filter(Transfer.matricula == matricula)
        .order_by(Transfer.created_at.asc())
        .all()
    )

    return {
        "matricula": prop.matricula,
        "current_owner": prop.current_owner,
        "previous_owner": prop.previous_owner,
        "tx_hash": prop.tx_hash,
        "proposals": proposals,
        "transfers": transfers,
    }


@app.get("/audit/transfers", response_model=list[TransferAudit])
def audit_all_transfers(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista todas as transferências iniciadas com status atual (apenas regulador)."""
    role = user.get("role", "USER")
    if role != Role.REGULATOR.value:
        raise HTTPException(status_code=403, detail="Apenas regulador pode consultar histórico")

    transfers = db.query(Transfer).order_by(Transfer.created_at.desc()).all()
    return transfers
