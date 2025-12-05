import os
import secrets
import time

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy.orm import Session

from .models import Nonce, User


JWT_SECRET = os.getenv("JWT_SECRET", "changeme")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "120"))
SIWE_DOMAIN = os.getenv("SIWE_DOMAIN", "localhost:3000")
SIWE_URI = os.getenv("SIWE_URI", "http://localhost:3000")
SIWE_CHAIN_ID = int(os.getenv("SIWE_CHAIN_ID", "11155111"))


def generate_nonce(db: Session, wallet: str | None = None) -> str:
    """Cria e persiste um nonce para o fluxo SIWE."""
    nonce = secrets.token_hex(16)
    db.add(Nonce(wallet=wallet or "*", nonce=nonce))
    db.commit()
    return nonce


def build_siwe_message(address: str, nonce: str) -> str:
    """Mensagem SIWE minimalista compatível com o backend."""
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    msg = (
        f"{SIWE_DOMAIN} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"URI: {SIWE_URI}\n"
        f"Version: 1\n"
        f"Chain ID: {SIWE_CHAIN_ID}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )
    return msg


def verify_signature(address: str, message: str, signature: str) -> bool:
    """Valida a assinatura SIWE usando recover."""
    try:
        msg = encode_defunct(text=message)
        recovered = Account.recover_message(msg, signature=signature)
        return recovered.lower() == address.lower()
    except Exception:
        return False


def issue_jwt(user: User) -> str:
    payload = {
        "sub": user.wallet.lower(),
        "role": user.role.value,
        "exp": int(time.time()) + JWT_EXPIRES_MIN * 60,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
