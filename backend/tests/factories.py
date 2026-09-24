"""Aides pour construire des espaces de travail de test (grille vide de créneaux)."""

from __future__ import annotations

from app.schemas import Cell, Level, Place, Settings, Sport, TimeRow, Timetable, Workspace

ALL = ["Q1", "Q2", "Q3", "Q4"]


def grid(days: int = 2, minutes: list[int] | None = None, closed=(), missing=(), spans=None) -> Timetable:
    """Grille ``days`` x len(minutes). ``closed``/``missing`` : cellules (jour, ligne) ; ``spans`` : {(j, l): n}."""
    minutes = minutes if minutes is not None else [60, 60]
    spans = spans or {}
    cells = []
    for d in range(days):
        covered: set[int] = set()
        for r in range(len(minutes)):
            if r in covered or (d, r) in missing:
                continue
            span = spans.get((d, r), 1)
            covered.update(range(r + 1, r + span))
            cells.append(Cell(day=d, row=r, rowSpan=span, closed=(d, r) in closed))
    rows, t = [], 8 * 60
    for m in minutes:
        rows.append(TimeRow(label=f"r{len(rows)}", start=f"{t // 60}h{t % 60:02d}",
                            end=f"{(t + m) // 60}h{(t + m) % 60:02d}", minutes=m))
        t += m
    return Timetable(days=[f"J{d}" for d in range(days)], rows=rows, cells=cells)


def slots(tt: Timetable) -> list[str]:
    return [c.slot_id for c in tt.cells if not c.closed]


def place(pid: str, avail: dict[str, list[str]] | list[str], outdoor=False, capacity=1) -> Place:
    availability = avail if isinstance(avail, dict) else {s: list(ALL) for s in avail}
    return Place(id=pid, name=pid.capitalize(), outdoor=outdoor, capacity=capacity, availability=availability)


def level(lid, sports, mode="trimestre", cycle=None, groups=1, name=None) -> Level:
    return Level(id=lid, name=name or lid, mode=mode, sportIds=sports, groups=groups, cycle=cycle or [[60]])


def sport(sid, places, priority=False, barrette=False) -> Sport:
    return Sport(id=sid, name=sid.capitalize(), priority=priority, barrette=barrette, placeIds=places)


def workspace(tt, levels, sports, places, **settings) -> Workspace:
    base = {"maxSolutions": 5, "timeLimit": 5}
    base.update(settings)
    return Workspace(timetable=tt, levels=levels, sports=sports, places=places, settings=Settings(**base))
