"""Configuration lue dans l'environnement (voir Docs/ORQEA_SSO.md)."""

from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass
from urllib.parse import urlsplit

log = logging.getLogger("sportsplitter")

MIN_SECRET_LENGTH = 32


class ConfigError(RuntimeError):
    """Configuration dangereuse : le démarrage est refusé."""


@dataclass(frozen=True)
class Config:
    sso_secret: str | None = None  # partagé avec Orqea, ne sert QU'À vérifier les jetons de passation
    session_secret: str = ""  # propre à SportSplitter, signe les sessions
    public_url: str = "http://localhost:8090"
    orqea_url: str = "https://orqea.dev"
    env: str = "development"
    dev_login: bool = False
    legacy_owner_sub: str | None = None

    @property
    def production(self) -> bool:
        return self.env == "production"

    @property
    def public_origin(self) -> str:
        parts = urlsplit(self.public_url)
        return f"{parts.scheme}://{parts.netloc}"


def load_config(environ: dict[str, str] | None = None) -> Config:
    env = dict(os.environ if environ is None else environ)
    mode = env.get("SPORTSPLITTER_ENV", "development")
    production = mode == "production"

    sso = env.get("SPORTSPLITTER_SSO_SECRET") or None
    if sso is not None and len(sso) < MIN_SECRET_LENGTH:
        log.warning("SPORTSPLITTER_SSO_SECRET fait moins de %d caractères : il est ignoré, toute connexion "
                    "via Orqea sera refusée (SSO_DISABLED).", MIN_SECRET_LENGTH)
        sso = None
    if sso is None:
        log.warning("Aucun SPORTSPLITTER_SSO_SECRET valide : connexion via Orqea désactivée.")

    session = env.get("SPORTSPLITTER_SESSION_SECRET") or ""
    if production and len(session) < MIN_SECRET_LENGTH:
        raise ConfigError(f"SPORTSPLITTER_SESSION_SECRET (≥ {MIN_SECRET_LENGTH} caractères) est obligatoire "
                          "en production.")
    if not session:
        session = secrets.token_urlsafe(48)  # développement : valeur aléatoire par processus

    dev_login = env.get("SPORTSPLITTER_DEV_LOGIN", "") not in ("", "0", "false", "False")
    if dev_login and production:
        raise ConfigError("SPORTSPLITTER_DEV_LOGIN est interdit quand SPORTSPLITTER_ENV=production.")

    if sso is not None and sso == session:
        raise ConfigError("SPORTSPLITTER_SSO_SECRET et SPORTSPLITTER_SESSION_SECRET doivent être différents.")

    return Config(
        sso_secret=sso,
        session_secret=session,
        public_url=env.get("SPORTSPLITTER_PUBLIC_URL", "http://localhost:8090"),
        orqea_url=env.get("SPORTSPLITTER_ORQEA_URL", "https://orqea.dev"),
        env=mode,
        dev_login=dev_login,
        legacy_owner_sub=env.get("SPORTSPLITTER_LEGACY_OWNER_SUB") or None,
    )
