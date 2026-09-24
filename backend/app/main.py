from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from fastapi import Body, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from . import excel_io
from .db import Store
from .schemas import Issue, Solution, SolveResult, Timetable, Workspace
from .solver import solve
from .validation import validate

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

app = FastAPI(title="SportsSplitter API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@lru_cache
def get_store() -> Store:
    return Store()


def current_role() -> str:
    """Rôle de l'utilisateur. En développement tout le monde est administrateur ;
    à terme, il viendra de l'authentification."""
    return os.getenv("SPORTSPLITTER_ROLE", "admin")


class Me(BaseModel):
    role: str
    permissions: list[str]


@app.get("/api/me", response_model=Me)
def me(role: str = Depends(current_role)):
    perms = ["edit_workspace"] + (["edit_rules"] if role == "admin" else [])
    return Me(role=role, permissions=perms)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/workspace", response_model=Workspace)
def read_workspace(store: Store = Depends(get_store)):
    return store.load()


@app.put("/api/workspace", response_model=Workspace)
def write_workspace(ws: Workspace, store: Store = Depends(get_store), role: str = Depends(current_role)):
    if role != "admin" and ws.settings != store.load().settings:
        raise HTTPException(status_code=403, detail="Seul un administrateur peut modifier les règles.")
    store.save(ws)
    return ws


@app.post("/api/timetable/parse", response_model=Timetable)
async def parse_timetable(file: UploadFile = File(...)):
    try:
        return excel_io.parse_timetable(await file.read(), file.filename or "")
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/timetable/template")
def template(saturday: bool = False):
    return Response(excel_io.template_workbook(saturday), media_type=XLSX,
                    headers={"Content-Disposition": 'attachment; filename="modele-emploi-du-temps.xlsx"'})


@app.post("/api/validate", response_model=list[Issue])
def validate_ws(ws: Workspace):
    return validate(ws)


@app.post("/api/solve", response_model=SolveResult)
def run_solve(ws: Workspace):
    return solve(ws)


class ExportRequest(BaseModel):
    workspace: Workspace
    solutions: list[Solution]
    lang: Literal["fr", "en"] = "fr"


@app.post("/api/export")
def export(req: ExportRequest = Body(...)):
    if not req.solutions:
        raise HTTPException(status_code=422, detail="Aucune solution à exporter.")
    try:
        data = excel_io.export_solutions(req.workspace, req.solutions, req.lang)
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    name = "planning.xlsx" if len(req.solutions) == 1 else "plannings.xlsx"
    return Response(data, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})
