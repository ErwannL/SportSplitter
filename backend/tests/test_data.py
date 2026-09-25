"""Données par utilisateur, règles globales, reprise de l'ancien espace unique."""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, text

from app.db import Store
from app.main import create_app
from app.schemas import Workspace

from .conftest import login, make_client, make_config
from .factories import grid, level, workspace


def _ws(name: str) -> dict:
    """Espace avec les règles par défaut (celles de la base neuve)."""
    return Workspace(timetable=grid(), levels=[level(name, ["s"])]).model_dump(by_alias=True, mode="json")


def test_users_are_isolated(tmp_path):
    a = login(make_client(tmp_path), sub="A", role="user")
    b = login(make_client(tmp_path), sub="B", role="user")
    assert a.put("/api/workspace", json=_ws("de A")).status_code == 200
    assert b.get("/api/workspace").json()["levels"] == []  # B ne lit pas l'espace de A
    assert b.put("/api/workspace", json=_ws("de B")).status_code == 200
    assert a.get("/api/workspace").json()["levels"][0]["name"] == "de A"  # ni ne l'écrase
    assert b.get("/api/workspace").json()["levels"][0]["name"] == "de B"


def test_rules_are_global_and_admin_only(tmp_path):
    admin = login(make_client(tmp_path), sub="adm", role="admin")
    user = login(make_client(tmp_path), sub="usr", role="user")
    body = _ws("x")
    body["settings"]["maxSolutions"] = 9
    assert admin.put("/api/workspace", json=body).json()["settings"]["maxSolutions"] == 9
    assert user.get("/api/workspace").json()["settings"]["maxSolutions"] == 9  # globales
    mine = user.get("/api/workspace").json()
    mine["settings"]["maxSolutions"] = 3
    r = user.put("/api/workspace", json=mine)
    assert r.status_code == 403 and r.json() == {"code": "RULES_ADMIN_ONLY"}
    assert admin.get("/api/workspace").json()["settings"]["maxSolutions"] == 9
    mine["settings"]["maxSolutions"] = 9  # sans changer les règles : autorisé
    assert user.put("/api/workspace", json=mine).status_code == 200
    body["settings"]["maxSolutions"] = 11
    admin.put("/api/workspace", json=body)
    assert user.get("/api/workspace").json()["settings"]["maxSolutions"] == 11


def test_preferences_are_per_user(tmp_path):
    a = login(make_client(tmp_path), sub="A", role="user")
    b = login(make_client(tmp_path), sub="B", role="user")
    body = _ws("a")
    body["preferences"]["saturday"] = True
    a.put("/api/workspace", json=body)
    assert a.get("/api/workspace").json()["preferences"]["saturday"] is True
    assert b.get("/api/workspace").json()["preferences"]["saturday"] is False


def test_dump_only_contains_own_workspace(tmp_path):
    import io
    import zipfile

    a = login(make_client(tmp_path), sub="A", role="user")
    b = login(make_client(tmp_path), sub="B", role="user")
    a.put("/api/workspace", json=_ws("secret-de-A"))
    with zipfile.ZipFile(io.BytesIO(b.get("/api/debug/dump").content)) as z:
        assert "secret-de-A" not in z.read("donnees.json").decode()
    with zipfile.ZipFile(io.BytesIO(a.get("/api/debug/dump").content)) as z:
        assert "secret-de-A" in z.read("donnees.json").decode()


# ------------------------------------------------------------------ ancien espace unique


def _legacy_db(path) -> str:
    """Base d'avant les comptes : table workspace sans owner_sub, une ligne id=1."""
    url = f"sqlite:///{path}"
    engine = create_engine(url)
    old = workspace(grid(), [level("ancien", ["s"])], [], [], maxSolutions=42)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE workspace (id INTEGER PRIMARY KEY, data JSON, updated_at DATETIME)"))
        conn.execute(text("INSERT INTO workspace (id, data, updated_at) VALUES (1, :d, '2026-09-24 10:00:00')"),
                     {"d": old.model_dump_json(by_alias=True)})
    engine.dispose()
    return url


def _row(url):
    engine = create_engine(url)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, owner_sub FROM workspace ORDER BY id")).all()
    engine.dispose()
    return [tuple(r) for r in rows]


def test_migration_without_legacy_owner_keeps_row(tmp_path, caplog):
    caplog.set_level(logging.INFO)
    url = _legacy_db(tmp_path / "old.db")
    store = Store(url)
    create_app(make_config(), store)
    assert _row(url) == [(1, None)]  # conservée, jamais supprimée
    assert "n'a pas de propriétaire" in caplog.text and "owner_sub ajoutée" in caplog.text
    assert store.settings().max_solutions == 42  # les règles reprennent celles de l'ancien espace
    # un nouvel utilisateur obtient un espace vide, pas l'ancien
    store.save("new", Workspace())
    assert store.load("new").levels == [] and _row(url) == [(1, None), (2, "new")]


def test_migration_with_legacy_owner(tmp_path):
    url = _legacy_db(tmp_path / "old.db")
    store = Store(url)
    create_app(make_config(legacy_owner_sub="4821"), store)
    assert _row(url) == [(1, "4821")]
    assert store.load("4821").levels[0].name == "ancien"


def test_legacy_owner_set_later_is_claimed_on_next_start(tmp_path):
    url = _legacy_db(tmp_path / "old.db")
    create_app(make_config(), Store(url))  # 1er démarrage : variable absente
    assert _row(url) == [(1, None)]
    create_app(make_config(), Store(url))  # redémarrage, toujours rien : rien ne change
    assert _row(url) == [(1, None)]
    store = Store(url)
    create_app(make_config(legacy_owner_sub="4821"), store)  # variable posée après coup
    assert _row(url) == [(1, "4821")]
    assert store.load("4821").levels[0].name == "ancien"
    assert store.settings().max_solutions == 42  # règles reprises de l'ancien espace, même après attribution
    assert store.claim_legacy("4821") == "none"  # démarrages suivants : plus rien à faire


def test_legacy_owner_who_already_has_a_workspace(tmp_path, caplog):
    url = _legacy_db(tmp_path / "old.db")
    store = Store(url)
    store.save("4821", Workspace())
    assert store.claim_legacy("4821") == "conflict"
    assert "conservé sans propriétaire" in caplog.text
    assert (1, None) in _row(url)


def test_fresh_database(tmp_path):
    store = Store(f"sqlite:///{tmp_path}/new.db")
    assert store.claim_legacy(None) == "none" and store.settings().max_solutions == 200
    store.init_settings()
    assert store.settings().max_solutions == 200
    assert store.load("x").levels == []


def test_save_settings_without_init(tmp_path):
    store = Store(f"sqlite:///{tmp_path}/n.db")
    rules = store.settings()
    rules.max_solutions = 3
    store.save_settings(rules)
    assert store.settings().max_solutions == 3
