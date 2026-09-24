"""Outils communs : application isolée, sessions et jetons de passation Orqea."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app import auth
from app.config import Config
from app.db import Store
from app.main import create_app

SSO_SECRET = "s" * 40
SESSION_SECRET = "k" * 40
PUBLIC_URL = "http://localhost:8090"


def make_config(**over) -> Config:
    base = {"sso_secret": SSO_SECRET, "session_secret": SESSION_SECRET, "public_url": PUBLIC_URL}
    base.update(over)
    return Config(**base)


def mint(secret: str = SSO_SECRET, algorithm: str = "HS256", drop=(), **over) -> str:
    """Jeton de passation valide par défaut ; ``over`` remplace des claims, ``drop`` en retire."""
    now = int(time.time())
    claims = {"iss": "orqea", "aud": "sportsplitter", "sub": "4821", "email": "a@orqea.dev", "name": "Ada",
              "role": "user", "iat": now, "exp": now + 60, "jti": uuid.uuid4().hex}
    claims.update(over)
    for k in drop:
        claims.pop(k)
    return jwt.encode(claims, secret, algorithm=algorithm)


def make_client(tmp_path, cfg: Config | None = None, store: Store | None = None, name="t.db") -> TestClient:
    app = create_app(cfg or make_config(), store or Store(f"sqlite:///{tmp_path}/{name}"))
    return TestClient(app, headers={"X-Requested-With": "sportsplitter"})


def login(client: TestClient, sub: str = "4821", role: str = "admin") -> TestClient:
    """Ouvre une session directement (sans passer par Orqea)."""
    client.app.state.store.login(sub, f"{sub}@orqea.dev", f"User {sub}", role)
    client.cookies.set(auth.SESSION_COOKIE, auth.issue_session(sub, role, client.app.state.config))
    return client


@pytest.fixture
def client(tmp_path):
    return login(make_client(tmp_path))
