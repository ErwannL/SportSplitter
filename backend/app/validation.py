"""Vérifie qu'une configuration est complète avant de lancer le solveur."""

from __future__ import annotations

from .schemas import Issue, Workspace


def norm(name: str) -> str:
    return " ".join(name.strip().lower().split())


def level_by_name(ws: Workspace) -> dict[str, str]:
    return {norm(lv.name): lv.id for lv in ws.levels}


def validate(ws: Workspace) -> list[Issue]:
    issues: list[Issue] = []
    if ws.timetable is None:
        return [Issue(code="no_timetable", message="Aucun emploi du temps importé.")]

    known = level_by_name(ws)
    used_levels: set[str] = set()
    for cell in ws.timetable.cells:
        if cell.closed:
            continue
        for e in cell.entries:
            lid = known.get(norm(e.level))
            if lid is None:
                issues.append(Issue(code="unknown_level", target=e.level,
                                    message=f"Le niveau « {e.level} » de l'emploi du temps n'est pas configuré."))
            else:
                used_levels.add(lid)

    sports = {s.id: s for s in ws.sports}
    places = {p.id: p for p in ws.places}
    used_sports: set[str] = set()
    for lv in ws.levels:
        if lv.id not in used_levels:
            issues.append(Issue(severity="warning", code="level_unused", target=lv.id,
                                message=f"Le niveau « {lv.name} » n'apparaît pas dans l'emploi du temps."))
            continue
        valid = [sid for sid in lv.sport_ids if sid in sports]
        if not valid:
            issues.append(Issue(code="level_no_sport", target=lv.id,
                                message=f"Le niveau « {lv.name} » n'a aucun sport."))
        used_sports.update(valid)

    for sid in sorted(used_sports):
        sp = sports[sid]
        if not [pid for pid in sp.place_ids if pid in places]:
            issues.append(Issue(code="sport_no_place", target=sid,
                                message=f"Le sport « {sp.name} » n'a aucun lieu."))

    for pl in ws.places:
        if not any(pl.availability.values()):
            issues.append(Issue(severity="warning", code="place_never_available", target=pl.id,
                                message=f"Le lieu « {pl.name} » n'a aucun créneau de disponibilité."))
    dup = {}
    for lv in ws.levels:
        dup.setdefault(norm(lv.name), []).append(lv)
    for items in dup.values():
        if len(items) > 1:
            issues.append(Issue(code="duplicate_level", target=items[0].id,
                                message=f"Le niveau « {items[0].name} » est défini plusieurs fois."))
    return issues


def blocking(issues: list[Issue]) -> list[Issue]:
    return [i for i in issues if i.severity == "error"]
