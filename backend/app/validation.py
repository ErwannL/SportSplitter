"""Vérifie qu'une configuration est complète avant de lancer le solveur."""

from __future__ import annotations

from .messages import issue
from .schemas import Issue, Workspace


def norm(name: str) -> str:
    return " ".join(name.strip().lower().split())


def level_by_name(ws: Workspace) -> dict[str, str]:
    return {norm(lv.name): lv.id for lv in ws.levels}


def validate(ws: Workspace) -> list[Issue]:
    if ws.timetable is None:
        return [issue("no_timetable", target_type="timetable")]

    issues: list[Issue] = []
    known = level_by_name(ws)
    used_levels: set[str] = set()
    reported: set[str] = set()
    for cell in ws.timetable.cells:
        if cell.closed:
            continue
        for e in cell.entries:
            lid = known.get(norm(e.level))
            if lid is not None:
                used_levels.add(lid)
            elif norm(e.level) not in reported:
                reported.add(norm(e.level))
                issues.append(issue("unknown_level", target=e.level, target_type="level", level=e.level))

    sports = {s.id: s for s in ws.sports}
    places = {p.id: p for p in ws.places}
    used_sports: set[str] = set()
    for lv in ws.levels:
        if lv.id not in used_levels:
            issues.append(issue("level_unused", severity="warning", target=lv.id, target_type="level", level=lv.name))
            continue
        valid = [sid for sid in lv.sport_ids if sid in sports]
        if not valid:
            issues.append(issue("level_no_sport", target=lv.id, target_type="level", level=lv.name))
        used_sports.update(valid)

    for sid in sorted(used_sports):
        sp = sports[sid]
        if not [pid for pid in sp.place_ids if pid in places]:
            issues.append(issue("sport_no_place", target=sid, target_type="sport", sport=sp.name))

    for pl in ws.places:
        if not any(pl.availability.values()):
            issues.append(issue("place_never_available", severity="warning", target=pl.id, target_type="place",
                                place=pl.name))

    seen: dict[str, str] = {}
    for lv in ws.levels:
        key = norm(lv.name)
        if key in seen:
            issues.append(issue("duplicate_level", target=lv.id, target_type="level", level=lv.name))
        seen[key] = lv.id
    return issues


def blocking(issues: list[Issue]) -> list[Issue]:
    return [i for i in issues if i.severity == "error"]
