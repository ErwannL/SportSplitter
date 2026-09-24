"""Aides pour construire des espaces de travail de test."""

from __future__ import annotations

from app.schemas import Cell, Entry, Level, Place, Sport, Timetable, TimeRow, Workspace

ALL = ["Q1", "Q2", "Q3", "Q4"]


def timetable(grid: dict[tuple[int, int], str | list[tuple[str, int]]], days: int = 2, rows: int = 2) -> Timetable:
    cells = []
    for d in range(days):
        for r in range(rows):
            v = grid.get((d, r), [])
            if v == "closed":
                cells.append(Cell(day=d, row=r, closed=True))
            else:
                cells.append(Cell(day=d, row=r, entries=[Entry(level=n, groups=g) for n, g in v]))
    return Timetable(days=[f"J{d}" for d in range(days)],
                     rows=[TimeRow(label=f"{8 + 2 * r}h") for r in range(rows)], cells=cells)


def place(pid: str, slots: dict[str, list[str]] | list[str], outdoor=False, capacity=1) -> Place:
    avail = slots if isinstance(slots, dict) else {s: list(ALL) for s in slots}
    return Place(id=pid, name=pid.capitalize(), outdoor=outdoor, capacity=capacity, availability=avail)


def workspace(tt, levels, sports, places) -> Workspace:
    return Workspace(timetable=tt, levels=levels, sports=sports, places=places)


def level(lid, sports, mode="trimestre", name=None) -> Level:
    return Level(id=lid, name=name or lid, mode=mode, sportIds=sports)


def sport(sid, places, priority=False, barrette=False) -> Sport:
    return Sport(id=sid, name=sid.capitalize(), priority=priority, barrette=barrette, placeIds=places)
