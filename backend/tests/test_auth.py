"""Connexion via Orqea, session, CSRF, routes fermées par défaut."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.routing import APIRoute

from app import auth
from app.config import ConfigError, load_config
from app.db import UsedJti
from app.main import PUBLIC_PATHS, create_app

from .conftest import SESSION_SECRET, SSO_SECRET, login, make_client, make_config, mint

# ------------------------------------------------------------------ échange du jeton


def _sso(client, token):
    return client.post("/api/auth/sso", json={"token": token})


def test_valid_token_creates_then_updates_user(tmp_path):
    client = make_client(tmp_path)
    r = _sso(client, mint(role="admin", name="Ada", email="a@orqea.dev"))
    assert r.status_code == 204
    cookie = r.headers["set-cookie"]
    assert "ss_session=" in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    assert "Path=/" in cookie and "Secure" not in cookie  # pas de Secure hors production
    user = client.app.state.store.user("4821")
    assert (user.email, user.name, user.role) == ("a@orqea.dev", "Ada", "admin")
    first_login = user.last_login_at
    assert client.get("/api/me").json()["role"] == "admin"
    # connexion suivante : Orqea fait foi, y compris pour rétrograder un admin
    assert _sso(client, mint(role="user", name="Ada L.", email="ada@orqea.dev")).status_code == 204
    user = client.app.state.store.user("4821")
    assert (user.email, user.name, user.role) == ("ada@orqea.dev", "Ada L.", "user")
    assert user.last_login_at >= first_login and user.created_at <= first_login
    assert client.get("/api/me").json()["permissions"] == ["edit_workspace"]


def test_secure_cookie_in_production(tmp_path):
    client = make_client(tmp_path, make_config(env="production"))
    assert "Secure" in _sso(client, mint()).headers["set-cookie"]


REFUSALS = {
    "mauvaise signature": (lambda: mint(secret="x" * 40), "SSO_INVALID"),
    "alg none": (lambda: jwt.encode({**jwt.decode(mint(), options={"verify_signature": False})}, None,
                                    algorithm="none"), "SSO_INVALID"),
    "iss faux": (lambda: mint(iss="evil"), "SSO_INVALID"),
    "aud faux": (lambda: mint(aud="gachapulse"), "SSO_INVALID"),
    "aud en liste": (lambda: mint(aud=["sportsplitter", "other"]), "SSO_INVALID"),
    "expiré": (lambda: mint(iat=int(time.time()) - 120, exp=int(time.time()) - 60), "SSO_EXPIRED"),
    "exp - iat > 60": (lambda: mint(exp=int(time.time()) + 61), "SSO_INVALID"),
    "iat dans le futur": (lambda: mint(iat=int(time.time()) + 30, exp=int(time.time()) + 60), "SSO_INVALID"),
    "role inconnu": (lambda: mint(role="superadmin"), "SSO_INVALID"),
    "sub absent": (lambda: mint(drop=["sub"]), "SSO_INVALID"),
    "sub vide": (lambda: mint(sub=" "), "SSO_INVALID"),
    "sub numérique": (lambda: mint(sub=4821), "SSO_INVALID"),
    "jti absent": (lambda: mint(drop=["jti"]), "SSO_INVALID"),
    "jti vide": (lambda: mint(jti=""), "SSO_INVALID"),
    "role absent": (lambda: mint(drop=["role"]), "SSO_INVALID"),
    "exp absent": (lambda: mint(drop=["exp"]), "SSO_INVALID"),
    "iat absent": (lambda: mint(drop=["iat"]), "SSO_INVALID"),
    "iat non entier": (lambda: mint(iat=float(time.time())), "SSO_INVALID"),
    "pas un jwt": (lambda: "pas-un-jeton", "SSO_INVALID"),
}


@pytest.mark.parametrize("case", sorted(REFUSALS))
def test_refusals(tmp_path, case):
    make, code = REFUSALS[case]
    client = make_client(tmp_path)
    r = _sso(client, make())
    assert r.status_code == 401 and r.json() == {"code": code}
    assert "set-cookie" not in r.headers
    assert client.app.state.store.user("4821") is None


def test_refuses_rs256(tmp_path):
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    r = _sso(make_client(tmp_path), mint(secret=key, algorithm="RS256"))
    assert r.status_code == 401 and r.json() == {"code": "SSO_INVALID"} and "set-cookie" not in r.headers


def test_replay_is_refused(tmp_path):
    client = make_client(tmp_path)
    token = mint()
    assert _sso(client, token).status_code == 204
    other = make_client(tmp_path)  # même base, autre navigateur
    r = _sso(other, token)
    assert r.status_code == 401 and r.json() == {"code": "SSO_REPLAYED"} and "set-cookie" not in r.headers


def test_expired_jti_are_purged(tmp_path):
    client = make_client(tmp_path)
    store = client.app.state.store
    with store.session() as s, s.begin():
        s.add(UsedJti(jti="old", expires_at=datetime.now(UTC) - timedelta(minutes=5)))
    assert _sso(client, mint()).status_code == 204
    with store.session() as s:
        assert s.get(UsedJti, "old") is None


@pytest.mark.parametrize("secret", [None, "court" * 3])
def test_missing_or_short_secret_disables_sso(tmp_path, secret):
    env = {"SPORTSPLITTER_SESSION_SECRET": SESSION_SECRET}
    if secret:
        env["SPORTSPLITTER_SSO_SECRET"] = secret
    cfg = load_config(env)
    assert cfg.sso_secret is None
    r = _sso(make_client(tmp_path, cfg), mint(secret=secret or SSO_SECRET))
    assert r.status_code == 401 and r.json() == {"code": "SSO_DISABLED"} and "set-cookie" not in r.headers


def test_tokens_and_secrets_never_logged(tmp_path, caplog):
    caplog.set_level(logging.DEBUG)
    client = make_client(tmp_path)
    good, bad, forged = mint(), mint(role="nope"), mint(secret="x" * 40)
    _sso(client, good)
    _sso(client, good)  # rejeu
    _sso(client, bad)
    _sso(client, forged)
    text = caplog.text
    for secret in (good, bad, forged, SSO_SECRET, SESSION_SECRET):
        assert secret not in text
    assert "code=SSO_REPLAYED sub=4821" in text and "code=SSO_INVALID sub=4821" in text


def test_unreadable_token_logs_no_sub(tmp_path, caplog):
    caplog.set_level(logging.WARNING)
    _sso(make_client(tmp_path), "garbage")
    assert "code=SSO_INVALID sub=None" in caplog.text


# ------------------------------------------------------------------ session


def test_me_requires_session_and_logout_clears_it(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me").json() == {"code": "UNAUTHENTICATED", "orqeaUrl": "https://orqea.dev"}
    assert _sso(client, mint()).status_code == 204
    assert client.get("/api/me").status_code == 200
    r = client.post("/api/auth/logout")
    assert r.status_code == 204 and 'ss_session=""' in r.headers["set-cookie"]
    assert client.get("/api/me").status_code == 401


@pytest.mark.parametrize("bad", ["expired", "sso_secret", "wrong_aud", "bad_role", "empty_sub", "garbage"])
def test_invalid_session_cookies(tmp_path, bad):
    client = make_client(tmp_path)
    cfg = client.app.state.config
    now = int(time.time())
    base = {"sub": "1", "role": "admin", "aud": auth.SESSION_AUDIENCE, "iat": now, "exp": now + 100}
    cookies = {
        "expired": auth.issue_session("1", "admin", cfg, now=now - 9 * 3600),
        # le porteur du secret partagé (Orqea) ne peut pas forger une session
        "sso_secret": jwt.encode(base, SSO_SECRET, algorithm="HS256"),
        "wrong_aud": jwt.encode({**base, "aud": "sportsplitter"}, SESSION_SECRET, algorithm="HS256"),
        "bad_role": jwt.encode({**base, "role": "root"}, SESSION_SECRET, algorithm="HS256"),
        "empty_sub": jwt.encode({**base, "sub": ""}, SESSION_SECRET, algorithm="HS256"),
        "garbage": "abc",
    }
    client.cookies.set(auth.SESSION_COOKIE, cookies[bad])
    assert client.get("/api/me").status_code == 401


def test_session_lifetime_is_8h(tmp_path):
    cfg = make_config()
    claims = jwt.decode(auth.issue_session("1", "user", cfg, now=1000), SESSION_SECRET, algorithms=["HS256"],
                        audience=auth.SESSION_AUDIENCE, options={"verify_exp": False})
    assert claims["exp"] - claims["iat"] == 8 * 3600


def test_handoff_token_is_not_a_session(tmp_path):
    client = make_client(tmp_path)
    client.cookies.set(auth.SESSION_COOKIE, mint())
    assert client.get("/api/me").status_code == 401


# ------------------------------------------------------------------ fermé par défaut


def _all_routes(app):
    """Toutes les routes /api, y compris celles des routeurs inclus (via le schéma OpenAPI, qui les liste
    toutes), plus les routes déclarées directement sur l'application."""
    seen = set()
    for path, ops in app.openapi()["paths"].items():
        for method in ops:
            seen.add((method.upper(), path))
    for route in app.routes:
        if isinstance(route, APIRoute) and route.path.startswith("/api"):
            seen.update((m, route.path) for m in route.methods)
    return sorted(seen)


def test_every_route_is_closed_without_session(tmp_path):
    client = make_client(tmp_path, make_config(dev_login=True))
    seen = 0
    for method, path in _all_routes(client.app):
        if (method, path) in PUBLIC_PATHS or path == "/api/auth/dev-login":
            continue
        seen += 1
        r = client.request(method, path.replace("{", "").replace("}", ""))
        assert r.status_code == 401, (method, path, r.status_code)
    assert seen >= 9
    # la liste blanche est exactement celle attendue
    assert {("GET", "/api/health"), ("POST", "/api/auth/sso"), ("POST", "/api/auth/logout")} == PUBLIC_PATHS


def test_public_routes_answer_without_session(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/api/health").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204


# ------------------------------------------------------------------ CSRF


def test_mutation_without_header_is_forbidden(tmp_path):
    client = login(make_client(tmp_path))
    r = client.put("/api/workspace", json={}, headers={"X-Requested-With": "other"})
    assert r.status_code == 403 and r.json() == {"code": "CSRF"}
    client.headers.pop("X-Requested-With")
    assert client.post("/api/validate", json={}).json() == {"code": "CSRF"}
    assert client.post("/api/auth/logout").status_code == 403
    assert client.get("/api/me").status_code == 200  # les lectures ne demandent pas l'en-tête
    # l'échange du jeton n'exige pas l'en-tête (il arrive depuis la page /sso)
    assert _sso(client, mint()).status_code == 204


def test_foreign_origin_is_forbidden(tmp_path):
    client = login(make_client(tmp_path))
    r = client.post("/api/validate", json={}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json() == {"code": "BAD_ORIGIN"}
    ok = client.post("/api/validate", json={"timetable": None}, headers={"Origin": "http://localhost:8090/"})
    assert ok.status_code == 200


# ------------------------------------------------------------------ dev-login et configuration


def test_dev_login_route_absent_by_default(tmp_path):
    assert make_client(tmp_path).post("/api/auth/dev-login", json={"sub": "1"}).status_code == 404


def test_dev_login_when_enabled(tmp_path):
    client = make_client(tmp_path, make_config(dev_login=True))
    assert client.post("/api/auth/dev-login", json={"sub": "7", "role": "user"}).status_code == 204
    assert client.get("/api/me").json()["name"] == "Dev 7"


def test_config_defaults_and_errors():
    cfg = load_config({})
    assert cfg.sso_secret is None and len(cfg.session_secret) >= 32 and not cfg.dev_login
    assert cfg.public_url == "http://localhost:8090" and cfg.orqea_url == "https://orqea.dev"
    assert load_config({}).session_secret != cfg.session_secret  # aléatoire par processus
    assert load_config({"SPORTSPLITTER_DEV_LOGIN": "1"}).dev_login
    assert not load_config({"SPORTSPLITTER_DEV_LOGIN": "0"}).dev_login
    prod = {"SPORTSPLITTER_ENV": "production", "SPORTSPLITTER_SESSION_SECRET": SESSION_SECRET}
    assert load_config(prod).production
    with pytest.raises(ConfigError, match="DEV_LOGIN"):
        load_config({**prod, "SPORTSPLITTER_DEV_LOGIN": "1"})
    with pytest.raises(ConfigError, match="SESSION_SECRET"):
        load_config({"SPORTSPLITTER_ENV": "production"})
    with pytest.raises(ConfigError, match="différents"):
        load_config({"SPORTSPLITTER_SSO_SECRET": SSO_SECRET, "SPORTSPLITTER_SESSION_SECRET": SSO_SECRET})
    full = load_config({"SPORTSPLITTER_SSO_SECRET": SSO_SECRET, "SPORTSPLITTER_PUBLIC_URL": "https://ss.orqea.dev/x",
                        "SPORTSPLITTER_LEGACY_OWNER_SUB": "42"})
    assert full.sso_secret == SSO_SECRET and full.public_origin == "https://ss.orqea.dev"
    assert full.legacy_owner_sub == "42"


def test_startup_refused_in_production_with_dev_login(monkeypatch):
    monkeypatch.setenv("SPORTSPLITTER_ENV", "production")
    monkeypatch.setenv("SPORTSPLITTER_SESSION_SECRET", SESSION_SECRET)
    monkeypatch.setenv("SPORTSPLITTER_DEV_LOGIN", "1")
    with pytest.raises(ConfigError):
        create_app()


def test_api_docs_hidden_in_production(tmp_path):
    assert make_client(tmp_path).get("/docs").status_code == 200
    prod = make_client(tmp_path, make_config(env="production"), name="p.db")
    assert prod.get("/docs").status_code == 404 and prod.get("/openapi.json").status_code == 404
