"""Connexion unique via Orqea : vérification du jeton de passation et session SportSplitter.

Contrat du jeton (émis par Orqea) : JWT HS256 signé avec SPORTSPLITTER_SSO_SECRET,
claims iss="orqea", aud="sportsplitter", sub, email, name, role ∈ {user, admin},
iat, exp (exp - iat ≤ 60 s), jti à usage unique. Voir Docs/ORQEA_SSO.md.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import jwt

from .config import Config

ISSUER = "orqea"
AUDIENCE = "sportsplitter"
ROLES = ("user", "admin")
MAX_TOKEN_LIFETIME = 60  # secondes
CLOCK_LEEWAY = 10  # secondes
REQUIRED = ["exp", "iat", "iss", "aud", "sub", "jti", "role"]

SESSION_COOKIE = "ss_session"
SESSION_AUDIENCE = "sportsplitter-session"
SESSION_LIFETIME = 8 * 3600  # 8 h, sans rafraîchissement : la révocation dans Orqea se propage en ≤ 8 h


class SSOError(Exception):
    def __init__(self, code: str, sub: str | None = None):
        super().__init__(code)
        self.code = code
        self.sub = sub


@dataclass
class Handoff:
    sub: str
    email: str
    name: str
    role: str
    jti: str
    exp: int


def _unverified_sub(token: str) -> str | None:
    """Pour la journalisation uniquement : le sub s'il est lisible, sans rien vérifier."""
    try:
        sub = jwt.decode(token, options={"verify_signature": False}).get("sub")
    except jwt.PyJWTError:
        return None
    return sub if isinstance(sub, str) else None


def verify_handoff(token: str, cfg: Config, now: float | None = None) -> Handoff:
    if not cfg.sso_secret:
        raise SSOError("SSO_DISABLED")
    sub = _unverified_sub(token)
    try:
        claims = jwt.decode(
            token,
            cfg.sso_secret,
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            leeway=CLOCK_LEEWAY,
            options={"require": REQUIRED, "strict_aud": True},
        )
    except jwt.ExpiredSignatureError as exc:
        raise SSOError("SSO_EXPIRED", sub) from exc
    except jwt.PyJWTError as exc:
        raise SSOError("SSO_INVALID", sub) from exc

    checks = (
        isinstance(claims["sub"], str) and claims["sub"].strip() != "",
        isinstance(claims["jti"], str) and claims["jti"].strip() != "",
        claims["role"] in ROLES,
        isinstance(claims["iat"], int) and isinstance(claims["exp"], int),
    )
    if not all(checks):
        raise SSOError("SSO_INVALID", sub)
    if claims["exp"] - claims["iat"] > MAX_TOKEN_LIFETIME:
        raise SSOError("SSO_INVALID", sub)
    return Handoff(sub=claims["sub"], email=str(claims.get("email") or ""), name=str(claims.get("name") or ""),
                   role=claims["role"], jti=claims["jti"], exp=claims["exp"])


def issue_session(sub: str, role: str, cfg: Config, now: float | None = None) -> str:
    t = int(now if now is not None else time.time())
    return jwt.encode({"sub": sub, "role": role, "aud": SESSION_AUDIENCE, "iat": t, "exp": t + SESSION_LIFETIME},
                      cfg.session_secret, algorithm="HS256")


def read_session(cookie: str | None, cfg: Config) -> dict | None:
    if not cookie:
        return None
    try:
        claims = jwt.decode(cookie, cfg.session_secret, algorithms=["HS256"], audience=SESSION_AUDIENCE,
                            options={"require": ["sub", "role", "exp"]})
    except jwt.PyJWTError:
        return None
    if claims["role"] not in ROLES or not isinstance(claims["sub"], str) or not claims["sub"]:
        return None
    return claims
