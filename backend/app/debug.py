"""Rapport de diagnostic : données + erreurs/avertissements du calcul, dans un zip."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime

from .schemas import PERIODS, SolveResult, Workspace
from .solver import fmt_minutes, solve


def summary(ws: Workspace) -> str:
    """Résumé lisible des données (grille, niveaux, sports, lieux, réglages)."""
    out: list[str] = []
    tt = ws.timetable
    if tt is None:
        out.append("GRILLE : aucune")
    else:
        opened = [c for c in tt.cells if not c.closed]
        out.append(f"GRILLE : {len(tt.days)} jours ({', '.join(tt.days)}), {len(tt.rows)} lignes, "
                   f"{len(opened)} cases ouvertes / {len(tt.cells)}")
        out.append("  durées des lignes (min) : " + ", ".join(f"{r.label}={r.minutes}" for r in tt.rows))
        for d, day in enumerate(tt.days):
            cells = sorted((c for c in tt.cells if c.day == d), key=lambda c: c.row)
            line = "".join(("#" if c.closed else ".") * c.row_span for c in cells)
            out.append(f"  {day:<10} {line}   (. ouvert, # fermé)")
    names = {s.id: s.name for s in ws.sports}
    pnames = {p.id: p.name for p in ws.places}
    out.append(f"\nNIVEAUX ({len(ws.levels)})")
    for lv in ws.levels:
        rhythm = " | ".join(f"S{chr(65 + w)}: " + (" + ".join(fmt_minutes(m) for m in week) or "rien")
                            for w, week in enumerate(lv.cycle))
        sports = ", ".join(names.get(s, f"<sport supprimé {s}>") for s in lv.sport_ids) or "aucun"
        out.append(f"  - {lv.name} [{lv.id}] : {lv.mode}, {lv.groups} classe(s) simultanée(s), rythme {rhythm}, "
                   f"sports : {sports}")
    out.append(f"\nSPORTS ({len(ws.sports)})")
    for sp in ws.sports:
        flags = [f for f, on in (("prioritaire", sp.priority), ("barrette", sp.barrette)) if on]
        places = ", ".join(pnames.get(p, f"<lieu supprimé {p}>") for p in sp.place_ids) or "aucun"
        out.append(f"  - {sp.name} [{sp.id}] {' '.join(flags)} : lieux {places}")
    out.append(f"\nLIEUX ({len(ws.places)})")
    for pl in ws.places:
        per_period = ", ".join(f"{p}={sum(all(seg in segs for seg in PERIODS[p]) for segs in pl.availability.values())}"
                               for p in PERIODS)
        out.append(f"  - {pl.name} [{pl.id}] capacité {pl.capacity}{', extérieur' if pl.outdoor else ''} ; "
                   f"cases disponibles par période : {per_period}")
    out.append("\nRÈGLES : " + json.dumps(ws.settings.model_dump(by_alias=True), ensure_ascii=False))
    out.append("PRÉFÉRENCES : " + json.dumps(ws.preferences.model_dump(by_alias=True), ensure_ascii=False))
    return "\n".join(out) + "\n"


def issues_text(result: SolveResult, severity: str) -> str:
    lines = [f"[{i.code}] {i.message}" + (f"  (cible {i.target_type}:{i.target})" if i.target else "")
             for i in result.issues if i.severity == severity]
    if severity == "warning":
        for sol in result.solutions[:1]:
            lines += [f"[{v.rule}] {v.message}" for v in sol.violations]
    return "\n".join(lines) + "\n" if lines else "(aucun)\n"


def dump_zip(ws: Workspace, now: datetime | None = None) -> tuple[str, bytes]:
    stamp = (now or datetime.now()).strftime("%Y-%m-%d_%H-%M-%S")
    result = solve(ws)
    head = (f"Dump SportsSplitter du {stamp}\nStatut du calcul : {result.status} ; "
            f"{result.total_found} solution(s){' (tronqué)' if result.truncated else ''}\n\n")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("LISEZMOI.txt", head + summary(ws))
        z.writestr("erreurs.txt", issues_text(result, "error"))
        z.writestr("avertissements.txt", issues_text(result, "warning"))
        z.writestr("donnees.json", ws.model_dump_json(by_alias=True, indent=2))
        z.writestr("resultat.json", result.model_dump_json(by_alias=True, indent=2))
    return f"dump_{stamp}.zip", buf.getvalue()
