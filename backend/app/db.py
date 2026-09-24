"""Persistance de l'espace de travail (un document JSON, un utilisateur local)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .schemas import Workspace

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sportsplitter.db")


class Base(DeclarativeBase):
    pass


class WorkspaceRow(Base):
    __tablename__ = "workspace"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserRow(Base):
    """Utilisateur connu (créé à sa première connexion via Orqea ; Orqea fait foi)."""

    __tablename__ = "users"
    sub: Mapped[str] = mapped_column(String(191), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), default="")
    name: Mapped[str] = mapped_column(String(320), default="")
    role: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UsedJti(Base):
    """Jetons de passation déjà consommés (usage unique)."""

    __tablename__ = "sso_used_jti"
    jti: Mapped[str] = mapped_column(String(191), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReplayError(Exception):
    """Le jti a déjà été utilisé."""


class Store:
    def __init__(self, url: str = DATABASE_URL):
        args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, connect_args=args, pool_pre_ping=True)
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(self.engine, expire_on_commit=False)

    def login(self, sub: str, email: str, name: str, role: str, jti: str | None = None,
              jti_expires: datetime | None = None) -> UserRow:
        """Consomme le jti (s'il y en a un) et crée ou met à jour l'utilisateur, dans une seule transaction."""
        now = datetime.now(timezone.utc)
        try:
            with self.session() as s, s.begin():
                s.execute(delete(UsedJti).where(UsedJti.expires_at < now))
                if jti is not None:
                    s.add(UsedJti(jti=jti, expires_at=jti_expires or now))
                    s.flush()
                user = s.get(UserRow, sub)
                if user is None:
                    user = UserRow(sub=sub, email=email, name=name, role=role, created_at=now, last_login_at=now)
                    s.add(user)
                else:
                    user.email, user.name, user.role, user.last_login_at = email, name, role, now
            return user
        except IntegrityError as exc:
            raise ReplayError(jti) from exc

    def user(self, sub: str) -> UserRow | None:
        with self.session() as s:
            return s.get(UserRow, sub)

    def load(self) -> Workspace:
        with self.session() as s:
            row = s.get(WorkspaceRow, 1)
            return Workspace.model_validate(row.data) if row else Workspace()

    def save(self, ws: Workspace) -> None:
        data = ws.model_dump(by_alias=True, mode="json")
        with self.session() as s, s.begin():
            _upsert(s, data)


def _upsert(s: Session, data: dict) -> None:
    row = s.get(WorkspaceRow, 1)
    now = datetime.now(timezone.utc)
    if row is None:
        s.add(WorkspaceRow(id=1, data=data, updated_at=now))
    else:
        row.data, row.updated_at = data, now
