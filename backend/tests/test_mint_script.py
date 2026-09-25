"""scripts/mint_sso_token.py fabrique un jeton accepté par le vrai vérificateur."""

import importlib.util
import json
from pathlib import Path

from app import auth

from .conftest import SSO_SECRET, make_client, make_config

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "mint_sso_token.py"
spec = importlib.util.spec_from_file_location("mint_sso_token", SCRIPT)
mint_script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mint_script)


def test_minted_token_is_accepted(tmp_path, capsys):
    assert mint_script.main(["--sub", "1", "--role", "admin", "--secret", SSO_SECRET, "--decode"]) == 0
    out = capsys.readouterr().out.strip().splitlines()
    url, token = out[-1], out[-2]
    claims = json.loads("\n".join(out[:-2]))
    assert url == f"http://localhost:8090/sso#sso={token}" and "?" not in url
    assert claims["sub"] == "1" and claims["role"] == "admin" and claims["exp"] - claims["iat"] == 60
    assert auth.verify_handoff(token, make_config()).sub == "1"
    client = make_client(tmp_path)
    assert client.post("/api/auth/sso", json={"token": token}).status_code == 204
    assert client.get("/api/me").json()["role"] == "admin"


def test_refuses_short_secret(capsys):
    assert mint_script.main(["--sub", "1", "--secret", "court"]) == 2
    assert "trop court" in capsys.readouterr().err


def test_payload_shape():
    p = mint_script.payload("7", "user", "e", "n", 60, now=100)
    assert p == {**p, "iss": "orqea", "aud": "sportsplitter", "sub": "7", "iat": 100, "exp": 160}
    assert len(p["jti"]) == 32
