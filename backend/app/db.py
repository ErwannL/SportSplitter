"""Persistance : un espace de travail par utilisateur (clé : sub Orqea), règles de l'algorithme globales."""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, delete, func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .schemas import Settings, Workspace

log = logging.getLogger("sportsplitter")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sportsplitter.db")


class Base(DeclarativeBase):
    pass


class WorkspaceRow(Base):
    __tablename__ = "workspace"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    data: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # propriétaire (sub Orqea) ; NULL = ancien espace unique d'avant les comptes, jamais supprimé
    owner_sub: Mapped[str | None] = mapped_column(String(191), unique=True, nullable=True)


class AppSettings(Base):
    """Règles de l'algorithme : globales, modifiables par un administrateur seulement."""

    __tablename__ = "app_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    data: Mapped[dict] = mapped_column(JSON)


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
        self._migrate()
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(self.engine, expire_on_commit=False)

    def _migrate(self) -> None:
        """Base d'avant les comptes : ajoute workspace.owner_sub (+ index unique) sans toucher aux données."""
        insp = inspect(self.engine)
        if "workspace" in insp.get_table_names() and "owner_sub" not in {
                c["name"] for c in insp.get_columns("workspace")}:
            with self.engine.begin() as conn:
                conn.execute(text("ALTER TABLE workspace ADD COLUMN owner_sub VARCHAR(191)"))
                conn.execute(text("CREATE UNIQUE INDEX ix_workspace_owner_sub ON workspace (owner_sub)"))
            log.info("Migration : colonne workspace.owner_sub ajoutée.")

    def login(self, sub: str, email: str, name: str, role: str, jti: str | None = None,
              jti_expires: datetime | None = None) -> UserRow:
        """Consomme le jti (s'il y en a un) et crée ou met à jour l'utilisateur, dans une seule transaction."""
        now = datetime.now(UTC)
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

    # ---------------------------------------------------------- règles globales

    def init_settings(self) -> None:
        """Au démarrage : si les règles globales n'existent pas encore, les reprend de l'ancien espace unique
        (id le plus petit), sinon les valeurs par défaut. Ne fait rien ensuite."""
        with self.session() as s, s.begin():
            if s.get(AppSettings, 1) is not None:
                return
            oldest = s.scalars(select(WorkspaceRow).order_by(WorkspaceRow.id)).first()
            settings = Workspace.model_validate(oldest.data).settings if oldest else Settings()
            s.add(AppSettings(id=1, data=settings.model_dump(by_alias=True, mode="json")))

    def settings(self) -> Settings:
        with self.session() as s:
            row = s.get(AppSettings, 1)
            return Settings.model_validate(row.data) if row else Settings()

    def save_settings(self, settings: Settings) -> None:
        data = settings.model_dump(by_alias=True, mode="json")
        with self.session() as s, s.begin():
            row = s.get(AppSettings, 1)
            if row is None:
                s.add(AppSettings(id=1, data=data))
            else:
                row.data = data

    # ---------------------------------------------------------- espaces de travail

    def load(self, sub: str) -> Workspace:
        """Espace de l'utilisateur, avec les règles globales."""
        with self.session() as s:
            row = s.scalars(select(WorkspaceRow).where(WorkspaceRow.owner_sub == sub)).first()
            ws = Workspace.model_validate(row.data) if row else Workspace()
        ws.settings = self.settings()
        return ws

    def save(self, sub: str, ws: Workspace) -> None:
        data = ws.model_dump(by_alias=True, mode="json")
        data.pop("settings", None)  # les règles vivent dans app_settings
        now = datetime.now(UTC)
        with self.session() as s, s.begin():
            row = s.scalars(select(WorkspaceRow).where(WorkspaceRow.owner_sub == sub)).first()
            if row is None:
                next_id = (s.scalar(select(func.max(WorkspaceRow.id))) or 0) + 1
                s.add(WorkspaceRow(id=next_id, owner_sub=sub, data=data, updated_at=now))
            else:
                row.data, row.updated_at = data, now

    def claim_legacy(self, sub: str | None) -> str:
        """Attribue l'ancien espace unique (sans propriétaire) à ``sub``. Rejoué à chaque démarrage, donc la
        variable SPORTSPLITTER_LEGACY_OWNER_SUB peut être posée après coup. Ne supprime jamais rien."""
        with self.session() as s, s.begin():
            legacy = s.scalars(select(WorkspaceRow).where(WorkspaceRow.owner_sub.is_(None))
                               .order_by(WorkspaceRow.id)).first()
            if legacy is None:
                return "none"
            if not sub:
                log.warning("Un espace de travail d'avant les comptes (id=%s) n'a pas de propriétaire : il est "
                            "conservé intact. Définissez SPORTSPLITTER_LEGACY_OWNER_SUB=<sub Orqea> pour "
                            "l'attribuer.", legacy.id)
                return "orphan"
            if s.scalars(select(WorkspaceRow).where(WorkspaceRow.owner_sub == sub)).first() is not None:
                log.warning("SPORTSPLITTER_LEGACY_OWNER_SUB=%s a déjà un espace : l'ancien espace (id=%s) est "
                            "conservé sans propriétaire.", sub, legacy.id)
                return "conflict"
            legacy.owner_sub = sub
            log.info("Ancien espace (id=%s) attribué à sub=%s.", legacy.id, sub)
            return "claimed"
