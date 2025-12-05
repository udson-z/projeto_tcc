from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from app.database import get_db, Base, engine
from app.models import User, Nonce, Role
from app.schemas import VerifySiweIn, TokenOut, AssignRoleIn    


app = FastAPI(title="POC ID1 – Auth by Wallet")

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    n = db.query(Nonce).filter(Nonce.nonce == payload.message.split("Nonce: ")[-1].split("\n")[0]).first()
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