#!/usr/bin/env python3
"""Fabrique un jeton de passation Orqea valide avec le secret LOCAL, pour tester le vrai parcours /sso.

    python scripts/mint_sso_token.py --sub 1 --role admin
    python scripts/mint_sso_token.py --sub 1 --role admin --decode      # affiche aussi le payload

Le secret est lu dans SPORTSPLITTER_SSO_SECRET (ou --secret). Affiche l'URL à ouvrir dans le navigateur :
<SPORTSPLITTER_PUBLIC_URL>/sso#sso=<jeton>. Le jeton n'est valable que 60 secondes et une seule fois.
Outil de développement : en production, c'est Orqea qui émet ces jetons.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid

import jwt

MIN_SECRET_LENGTH = 32


def payload(sub: str, role: str, email: str, name: str, ttl: int, now: int | None = None) -> dict:
    iat = int(time.time()) if now is None else now
    return {"iss": "orqea", "aud": "sportsplitter", "sub": sub, "email": email, "name": name, "role": role,
            "iat": iat, "exp": iat + ttl, "jti": uuid.uuid4().hex}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sub", required=True, help="id utilisateur Orqea (chaîne)")
    parser.add_argument("--role", choices=["user", "admin"], default="user")
    parser.add_argument("--email", default="")
    parser.add_argument("--name", default="")
    parser.add_argument("--ttl", type=int, default=60, help="durée de validité en secondes (≤ 60)")
    parser.add_argument("--secret", default=os.environ.get("SPORTSPLITTER_SSO_SECRET", ""))
    parser.add_argument("--url", default=os.environ.get("SPORTSPLITTER_PUBLIC_URL", "http://localhost:8090"))
    parser.add_argument("--decode", action="store_true", help="affiche aussi le payload JSON")
    args = parser.parse_args(argv)

    if len(args.secret) < MIN_SECRET_LENGTH:
        print(f"SPORTSPLITTER_SSO_SECRET absent ou trop court (≥ {MIN_SECRET_LENGTH} caractères).", file=sys.stderr)
        return 2
    claims = payload(args.sub, args.role, args.email or f"user{args.sub}@example.org",
                     args.name or f"Utilisateur {args.sub}", args.ttl)
    token = jwt.encode(claims, args.secret, algorithm="HS256")
    if args.decode:
        print(json.dumps(claims, indent=2, ensure_ascii=False))
    print(token)
    print(f"{args.url.rstrip('/')}/sso#sso={token}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
