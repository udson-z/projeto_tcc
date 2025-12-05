from sqlalchemy import String, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base
import enum


class Role(str, enum.Enum):
    USER = "USER"
    REGULATOR = "REGULATOR"
    FINANCIAL = "FINANCIAL"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.USER)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Nonce(Base):
    __tablename__ = "nonces"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    wallet: Mapped[str] = mapped_column(String(64), index=True)
    nonce: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())