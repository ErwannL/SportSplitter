"""Génération des plannings par programmation par contraintes (OR-Tools CP-SAT).

Modèle
------
* ``x[l, p, s]`` : le niveau ``l`` pratique le sport ``s`` pendant la période ``p``.
* Chaque « occurrence » est un créneau de l'emploi du temps où un niveau a EPS,
  avec ``g`` classes simultanées. Pour chaque période du niveau, ``n[o, p, pl]``
  classes de l'occurrence vont dans le lieu ``pl`` (``b`` = lieu utilisé).

Règles strictes : un sport par période, sports prioritaires toujours placés,
lieux compatibles avec le sport, disponibilité et capacité des lieux sur
chaque segment de l'année, barrette = les classes d'un même niveau
ensemble dans un seul lieu (au moins 2 classes).
Règle assouplissable : lieu extérieur utilisé en hiver.
"""

from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from .schemas import (MODE_PERIODS, PERIOD_LABELS, PERIODS, Assignment, Issue, Placement, Solution,
                      SolveResult, Violation, Workspace)
from .validation import blocking, level_by_name, norm, validate


@dataclass
class Occurrence:
    slot_id: str
    level_id: str
    groups: int


def _occurrences(ws: Workspace) -> list[Occurrence]:
    names = level_by_name(ws)
    occ: list[Occurrence] = []
    assert ws.timetable is not None
    for cell in ws.timetable.cells:
        if cell.closed:
            continue
        for e in cell.entries:
            lid = names.get(norm(e.level))
            if lid:
                occ.append(Occurrence(cell.slot_id, lid, max(1, e.groups)))
    return occ


def diagnose(ws: Workspace) -> list[Issue]:
    """Détecte les causes évidentes d'impossibilité, niveau par niveau."""
    issues: list[Issue] = []
    sports = {s.id: s for s in ws.sports}
    places = {p.id: p for p in ws.places}
    occ = _occurrences(ws)
    for lv in ws.levels:
        mine = [o for o in occ if o.level_id == lv.id]
        if not mine:
            continue
        periods = MODE_PERIODS[lv.mode]
        lsports = [sports[s] for s in lv.sport_ids if s in sports]
        prio = [s for s in lsports if s.priority]
        if len(prio) > len(periods):
            issues.append(Issue(code="too_many_priority", target=lv.id, message=(
                f"« {lv.name} » a {len(prio)} sports prioritaires pour seulement {len(periods)} périodes.")))
        for sp in lsports:
            possible = [p for p in periods if all(
                any(all(seg in places[pid].availability.get(o.slot_id, []) for seg in PERIODS[p])
                    for pid in sp.place_ids if pid in places) for o in mine)]
            if sp.priority and not possible:
                issues.append(Issue(code="priority_impossible", target=sp.id, message=(
                    f"Le sport prioritaire « {sp.name} » ne peut être placé à aucune période pour « {lv.name} » : "
                    "aucun de ses lieux n'est disponible sur tous les créneaux de ce niveau.")))
                continue
            if sp.barrette and any(o.groups < 2 for o in mine):
                issues.append(Issue(severity="warning", code="barrette_single", target=sp.id, message=(
                    f"« {sp.name} » est en barrette mais « {lv.name} » a des créneaux avec une seule classe.")))
            for p in periods:
                segs = PERIODS[p]
                ok = all(any(all(seg in places[pid].availability.get(o.slot_id, []) for seg in segs)
                             for pid in sp.place_ids if pid in places) for o in mine)
                if not ok:
                    issues.append(Issue(severity="warning", code="sport_period_unavailable", target=sp.id,
                                        message=(f"« {sp.name} » ne peut pas être pratiqué par « {lv.name} » au "
                                                 f"{PERIOD_LABELS[p]} : aucun lieu disponible sur tous ses créneaux.")))
        usable = 0
        for p in periods:
            if any(not (sp.barrette and any(o.groups < 2 for o in mine)) and all(
                    any(all(seg in places[pid].availability.get(o.slot_id, []) for seg in PERIODS[p])
                        for pid in sp.place_ids if pid in places) for o in mine) for sp in lsports):
                usable += 1
        if usable < len(periods):
            issues.append(Issue(code="level_blocked", target=lv.id, message=(
                f"« {lv.name} » : {len(periods) - usable} période(s) sans aucun sport possible "
                "(vérifiez les disponibilités des lieux).")))
    return issues


class _Model:
    def __init__(self, ws: Workspace, max_winter: int | None):
        self.ws = ws
        m = self.m = cp_model.CpModel()
        sports = self.sports = {s.id: s for s in ws.sports}
        places = self.places = {p.id: p for p in ws.places}
        self.occ = _occurrences(ws)
        winter = set(ws.settings.winter_segments)
        self.x: dict[tuple[str, str, str], cp_model.IntVar] = {}
        self.n: dict[tuple[int, str, str], cp_model.IntVar] = {}
        self.b: dict[tuple[int, str, str], cp_model.IntVar] = {}
        self.v: dict[tuple[str, str], cp_model.IntVar] = {}
        self.levels = [lv for lv in ws.levels if any(o.level_id == lv.id for o in self.occ)]

        for lv in self.levels:
            periods = MODE_PERIODS[lv.mode]
            mine = [o for o in self.occ if o.level_id == lv.id]
            single = any(o.groups < 2 for o in mine)
            # un sport en barrette est impossible si un créneau n'a qu'une classe
            lsports = [s for s in dict.fromkeys(lv.sport_ids)
                       if s in sports and not (sports[s].barrette and single)]
            for p in periods:
                for s in lsports:
                    self.x[lv.id, p, s] = m.new_bool_var(f"x_{lv.id}_{p}_{s}")
                m.add_exactly_one(self.x[lv.id, p, s] for s in lsports)
            for s in lsports:
                uses = [self.x[lv.id, p, s] for p in periods]
                if len(lsports) <= len(periods):
                    m.add(sum(uses) >= 1)
                else:
                    m.add(sum(uses) <= 1)
                    if sports[s].priority:
                        m.add(sum(uses) == 1)
            winter_vars = []
            for p in periods:
                segs = PERIODS[p]
                is_winter = bool(winter.intersection(segs))
                pv = []
                for oi, o in ((i, o) for i, o in enumerate(self.occ) if o.level_id == lv.id):
                    cand = []
                    for pid, place in places.items():
                        supporting = [self.x[lv.id, p, s] for s in lsports if pid in sports[s].place_ids]
                        if not supporting:
                            continue
                        if not all(seg in place.availability.get(o.slot_id, []) for seg in segs):
                            continue
                        b = m.new_bool_var(f"b_{oi}_{p}_{pid}")
                        n = m.new_int_var(0, o.groups, f"n_{oi}_{p}_{pid}")
                        m.add(n <= o.groups * b)
                        m.add(n >= b)
                        m.add(b <= sum(supporting))
                        self.b[oi, p, pid], self.n[oi, p, pid] = b, n
                        cand.append(pid)
                        if place.outdoor and is_winter:
                            pv.append(b)
                    m.add(sum(self.n[oi, p, pid] for pid in cand) == o.groups)
                    # barrette : toutes les classes dans un seul lieu
                    barr = [self.x[lv.id, p, s] for s in lsports if sports[s].barrette]
                    if barr and cand:
                        m.add(sum(self.b[oi, p, pid] for pid in cand) <= 1 + len(cand) * (1 - sum(barr)))
                if pv:
                    v = m.new_bool_var(f"v_{lv.id}_{p}")
                    for bb in pv:
                        m.add(v >= bb)
                    self.v[lv.id, p] = v
                    winter_vars.append(v)

        # capacité des lieux, segment par segment
        for pid, place in places.items():
            by: dict[tuple[str, str], list] = {}
            for (oi, p, ppid), n in self.n.items():
                if ppid != pid:
                    continue
                for seg in PERIODS[p]:
                    by.setdefault((self.occ[oi].slot_id, seg), []).append(n)
            for terms in by.values():
                if len(terms) > 0:
                    m.add(sum(terms) <= max(1, place.capacity))

        self.violation_count = sum(self.v.values()) if self.v else 0
        if max_winter is not None and self.v:
            m.add(self.violation_count <= max_winter)

    def extract(self, solver, index: int) -> Solution:
        plan: dict[str, dict[str, str]] = {}
        for (lid, p, s), var in self.x.items():
            if solver.value(var):
                plan.setdefault(lid, {})[p] = s
        assignments = []
        for oi, o in enumerate(self.occ):
            lv_mode = next(lv.mode for lv in self.levels if lv.id == o.level_id)
            for p in MODE_PERIODS[lv_mode]:
                pls = [Placement(placeId=pid, groups=solver.value(n))
                       for (i, pp, pid), n in self.n.items() if i == oi and pp == p and solver.value(n) > 0]
                assignments.append(Assignment(slotId=o.slot_id, levelId=o.level_id, period=p,
                                              sportId=plan[o.level_id][p], placements=pls))
        violations = []
        names = {lv.id: lv.name for lv in self.ws.levels}
        for (lid, p), v in self.v.items():
            if solver.value(v):
                pids = sorted({pid for (oi, pp, pid), b in self.b.items()
                               if pp == p and self.occ[oi].level_id == lid and solver.value(b)
                               and self.places[pid].outdoor})
                pname = ", ".join(self.places[x].name for x in pids)
                violations.append(Violation(rule="winter_outdoor", levelId=lid, period=p,
                                            placeId=pids[0] if pids else None,
                                            message=(f"« {names[lid]} » utilise un lieu extérieur ({pname}) "
                                                     f"pendant l'hiver ({PERIOD_LABELS[p]}).")))
        return Solution(index=index, plan=plan, assignments=assignments, violations=violations)


class _Collector(cp_model.CpSolverSolutionCallback):
    def __init__(self, model: _Model, limit: int):
        super().__init__()
        self.model, self.limit = model, limit
        self.solutions: list[Solution] = []
        self.seen: set[tuple] = set()
        self.truncated = False

    def on_solution_callback(self):
        sol = self.model.extract(self, len(self.solutions))
        key = tuple(sorted((a.slot_id, a.level_id, a.period, a.sport_id,
                            tuple(sorted((p.place_id, p.groups) for p in a.placements)))
                           for a in sol.assignments))
        if key in self.seen:
            return
        self.seen.add(key)
        self.solutions.append(sol)
        if len(self.solutions) >= self.limit:
            self.truncated = True
            self.stop_search()


def _enumerate(ws: Workspace, max_winter: int | None, exact_winter: int | None = None):
    model = _Model(ws, max_winter)
    if exact_winter is not None and model.v:
        model.m.add(model.violation_count == exact_winter)
    solver = cp_model.CpSolver()
    solver.parameters.enumerate_all_solutions = True
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    col = _Collector(model, max(1, ws.settings.max_solutions))
    status = solver.solve(model.m, col)
    if status == cp_model.UNKNOWN and not col.solutions:
        col.truncated = True
    return col, status


def _min_violations(ws: Workspace) -> int | None:
    model = _Model(ws, None)
    if model.v:
        model.m.minimize(model.violation_count)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    status = solver.solve(model.m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return int(solver.objective_value) if model.v else 0


def solve(ws: Workspace) -> SolveResult:
    issues = validate(ws)
    if blocking(issues):
        return SolveResult(status="infeasible", issues=issues)

    col, _ = _enumerate(ws, max_winter=0)
    if col.solutions:
        return SolveResult(status="ok", solutions=col.solutions, totalFound=len(col.solutions),
                           truncated=col.truncated, issues=issues)

    best = _min_violations(ws)
    if best is None:
        diag = diagnose(ws)
        if not blocking(diag):
            diag.append(Issue(code="no_solution", message=(
                "Aucune combinaison ne respecte toutes les règles : trop de classes pour les lieux "
                "disponibles sur certains créneaux. Ajoutez des disponibilités ou des lieux.")))
        return SolveResult(status="infeasible", issues=issues + diag)

    col, _ = _enumerate(ws, max_winter=None, exact_winter=best)
    note = Issue(severity="warning", code="relaxed", message=(
        f"Aucun planning parfait : meilleure solution avec {best} règle(s) d'hiver non respectée(s)."))
    return SolveResult(status="relaxed", solutions=col.solutions, totalFound=len(col.solutions),
                       truncated=col.truncated, issues=issues + [note])
