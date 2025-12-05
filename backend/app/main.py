import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import generate_nonce, issue_jwt, verify_signature
from app.blockchain import register_property_onchain
from app.database import Base, engine, get_db
from app.deps import get_current_user
from app.models import Nonce, Property, Role, User
from app.schemas import (
    AssignRoleIn,
    PropertyCreate,
    PropertyOut,
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
