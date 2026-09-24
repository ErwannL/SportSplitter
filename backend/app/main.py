from __future__ import annotations

from functools import lru_cache

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


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/workspace", response_model=Workspace)
def read_workspace(store: Store = Depends(get_store)):
    return store.load()


@app.put("/api/workspace", response_model=Workspace)
def write_workspace(ws: Workspace, store: Store = Depends(get_store)):
    store.save(ws)
    return ws


@app.post("/api/timetable/parse", response_model=Timetable)
async def parse_timetable(file: UploadFile = File(...)):
    try:
        return excel_io.parse_timetable(await file.read(), file.filename or "")
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/timetable/template")
def template():
    return Response(excel_io.template_workbook(), media_type=XLSX,
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


@app.post("/api/export")
def export(req: ExportRequest = Body(...)):
    if not req.solutions:
        raise HTTPException(status_code=422, detail="Aucune solution à exporter.")
    try:
        data = excel_io.export_solutions(req.workspace, req.solutions)
    except excel_io.TimetableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    name = "planning.xlsx" if len(req.solutions) == 1 else "plannings.xlsx"
    return Response(data, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})
