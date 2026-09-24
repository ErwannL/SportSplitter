from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Body, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import auth, debug, excel_io
from .config import Config, load_config
from .db import ReplayError, Store
from .schemas import Issue, Solution, SolveResult, Timetable, Workspace
from .solver import solve
from .validation import validate

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "sportsplitter"

log = logging.getLogger("sportsplitter")


class ApiError(Exception):
    """Erreur renvoyée sous la forme {"code": ...} (jamais de détail interne)."""

    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status, self.code = status, code


class SessionUser(BaseModel):
    sub: str
    email: str = ""
    name: str = ""
    role: Literal["user", "admin"]

    @property
    def permissions(self) -> list[str]:
        return ["edit_workspace"] + (["edit_rules"] if self.role == "admin" else [])


# ------------------------------------------------------------------ dépendances


def get_config(request: Request) -> Config:
    return request.app.state.config


def get_store(request: Request) -> Store:
    return request.app.state.store


def check_csrf(request: Request, cfg: Config = Depends(get_config)) -> None:
    """Mutations : en-tête X-Requested-With obligatoire et Origin (s'il est présent) = origine publique."""
    if request.method not in MUTATING:
        return
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise ApiError(403, "CSRF")
    origin = request.headers.get("origin")
    if origin is not None and origin.rstrip("/") != cfg.public_origin:
        raise ApiError(403, "BAD_ORIGIN")


def require_user(request: Request, cfg: Config = Depends(get_config), store: Store = Depends(get_store),
                 _: None = Depends(check_csrf)) -> SessionUser:
    """Appliquée à tout le routeur protégé : une route future ne peut pas l'oublier."""
    claims = auth.read_session(request.cookies.get(auth.SESSION_COOKIE), cfg)
    if claims is None:
        raise ApiError(401, "UNAUTHENTICATED")
    row = store.user(claims["sub"])
    user = SessionUser(sub=claims["sub"], role=claims["role"], email=row.email if row else "",
                       name=row.name if row else "")
    request.state.user = user
    return user


def current_user(request: Request) -> SessionUser:
    return request.state.user


# ------------------------------------------------------------------ routes publiques

public = APIRouter(prefix="/api")


@public.get("/health")
def health():
    return {"status": "ok"}


class SSORequest(BaseModel):
    token: str


def _set_session(response: Response, sub: str, role: str, cfg: Config) -> None:
    response.set_cookie(auth.SESSION_COOKIE, auth.issue_session(sub, role, cfg), max_age=auth.SESSION_LIFETIME,
                        httponly=True, samesite="lax", secure=cfg.production, path="/")


@public.post("/auth/sso", status_code=204)
def sso(body: SSORequest, cfg: Config = Depends(get_config), store: Store = Depends(get_store)):
    """Échange un jeton de passation Orqea contre une session SportSplitter (cookie httpOnly)."""
    try:
        h = auth.verify_handoff(body.token, cfg)
        store.login(h.sub, h.email, h.name, h.role, jti=h.jti,
                    jti_expires=datetime.fromtimestamp(h.exp + auth.CLOCK_LEEWAY, timezone.utc))
    except auth.SSOError as err:
        log.warning("connexion Orqea refusée : code=%s sub=%s", err.code, err.sub)
        raise ApiError(401, err.code) from None
    except ReplayError:
        log.warning("connexion Orqea refusée : code=SSO_REPLAYED sub=%s", h.sub)
        raise ApiError(401, "SSO_REPLAYED") from None
    log.info("connexion Orqea : sub=%s role=%s", h.sub, h.role)
    response = Response(status_code=204)
    _set_session(response, h.sub, h.role, cfg)
    return response


@public.post("/auth/logout", status_code=204, dependencies=[Depends(check_csrf)])
def logout(cfg: Config = Depends(get_config)):
    response = Response(status_code=204)
    response.delete_cookie(auth.SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=cfg.production)
    return response


class DevLogin(BaseModel):
    sub: str
    role: Literal["user", "admin"] = "admin"
    email: str = ""
    name: str = ""


def dev_login(body: DevLogin, cfg: Config = Depends(get_config), store: Store = Depends(get_store)):
    """Développement uniquement (SPORTSPLITTER_DEV_LOGIN=1) : la route n'existe pas sinon."""
    store.login(body.sub, body.email, body.name or f"Dev {body.sub}", body.role)
    response = Response(status_code=204)
    _set_session(response, body.sub, body.role, cfg)
    return response


# ------------------------------------------------------------------ routes protégées

api = APIRouter(prefix="/api", dependencies=[Depends(require_user)])


class Me(BaseModel):
    sub: str
    email: str
    name: str
    role: str
    permissions: list[str]


@api.get("/me", response_model=Me)
def me(user: SessionUser = Depends(current_user)):
    return Me(sub=user.sub, email=user.email, name=user.name, role=user.role, permissions=user.permissions)


@api.get("/workspace", response_model=Workspace)
def read_workspace(store: Store = Depends(get_store), user: SessionUser = Depends(current_user)):
    return store.load(user.sub)


@api.put("/workspace", response_model=Workspace)
def write_workspace(ws: Workspace, store: Store = Depends(get_store), user: SessionUser = Depends(current_user)):
    """Enregistre l'espace de l'utilisateur ; les règles (globales) ne changent que pour un admin."""
    if ws.settings != store.settings():
        if user.role != "admin":
            raise ApiError(403, "RULES_ADMIN_ONLY")
        store.save_settings(ws.settings)
    store.save(user.sub, ws)
    return store.load(user.sub)


@api.post("/timetable/parse", response_model=Timetable)
async def parse_timetable(file: UploadFile = File(...)):
    try:
        return excel_io.parse_timetable(await file.read(), file.filename or "")
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@api.get("/timetable/template")
def template(saturday: bool = False):
    return Response(excel_io.template_workbook(saturday), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="modele-emploi-du-temps.xlsx"'})


@api.post("/validate", response_model=list[Issue])
def validate_ws(ws: Workspace):
    return validate(ws)


@api.post("/solve", response_model=SolveResult)
def run_solve(ws: Workspace):
    return solve(ws)


class ExportRequest(BaseModel):
    workspace: Workspace
    solutions: list[Solution]
    lang: Literal["fr", "en"] = "fr"


@api.post("/export")
def export(req: ExportRequest = Body(...)):
    if not req.solutions:
        raise HTTPException(status_code=422, detail="Aucune solution à exporter.")
    try:
        data = excel_io.export_solutions(req.workspace, req.solutions, req.lang)
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    name = "planning.xlsx" if len(req.solutions) == 1 else "plannings.xlsx"
    return Response(data, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@api.get("/debug/dump")
def debug_dump(store: Store = Depends(get_store), user: SessionUser = Depends(current_user)):
    """Zip de diagnostic de l'espace de l'utilisateur connecté : données, erreurs et avertissements du calcul."""
    name, data = debug.dump_zip(store.load(user.sub))
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ------------------------------------------------------------------ application

PUBLIC_PATHS = {("GET", "/api/health"), ("POST", "/api/auth/sso"), ("POST", "/api/auth/logout")}


def create_app(cfg: Config | None = None, store: Store | None = None) -> FastAPI:
    cfg = cfg or load_config()
    # en production, pas de documentation publique de l'API (l'application ne se révèle pas)
    docs = {} if not cfg.production else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    app = FastAPI(title="SportSplitter by Orqea API", version="2.0.0", **docs)
    app.state.config = cfg
    app.state.store = store or Store()
    app.state.store.init_settings()
    app.state.store.claim_legacy(cfg.legacy_owner_sub)
    # Pas de CORS : le frontend est servi sur la même origine que /api (nginx).

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        body = {"code": exc.code}
        if exc.code == "UNAUTHENTICATED":  # l'écran « Accès via Orqea » a besoin du lien
            body["orqeaUrl"] = cfg.orqea_url
        return JSONResponse(body, status_code=exc.status)

    app.include_router(public)
    if cfg.dev_login:
        log.warning("SPORTSPLITTER_DEV_LOGIN actif : POST /api/auth/dev-login est ouvert (développement seulement).")
        app.add_api_route("/api/auth/dev-login", dev_login, methods=["POST"], status_code=204,
                          dependencies=[Depends(check_csrf)])
    app.include_router(api)
    return app


app = create_app()
