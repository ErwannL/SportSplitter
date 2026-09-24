"""Persistance de l'espace de travail (un document JSON, un utilisateur local)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, create_engine
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


class Store:
    def __init__(self, url: str = DATABASE_URL):
        args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, connect_args=args, pool_pre_ping=True)
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(self.engine, expire_on_commit=False)

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
