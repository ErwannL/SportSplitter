"""Génération des plannings par programmation par contraintes (OR-Tools CP-SAT).

Modèle
------
* ``x[l, p, s]`` : le niveau ``l`` pratique le sport ``s`` pendant la période ``p``.
* Chaque « occurrence » est un créneau de l'emploi du temps où un niveau a EPS,
  avec ``g`` classes simultanées. Pour chaque période du niveau, ``n[o, p, pl]``
  classes de l'occurrence vont dans le lieu ``pl`` (``b`` = lieu utilisé).

Règles strictes : un sport par période, lieux compatibles avec le sport,
disponibilité et capacité des lieux sur chaque segment de l'année, barrette
= les classes d'un même niveau ensemble dans un seul lieu.
Règles réglables par l'administrateur (``Settings``) : hiver (souple, stricte
ou ignorée), sports prioritaires obligatoires ou simplement préférés,
nombre minimal de classes pour une barrette, répétition des sports.
"""

from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from .messages import issue, render
from .schemas import MODE_PERIODS, PERIODS, Assignment, Issue, Placement, Solution, SolveResult, Violation, Workspace
from .validation import blocking, level_by_name, norm, validate


@dataclass
class Occurrence:
    slot_id: str
    level_id: str
    groups: int


def _occurrences(ws: Workspace) -> list[Occurrence]:
    names = level_by_name(ws)
    occ: list[Occurrence] = []
    for cell in ws.timetable.cells:  # type: ignore[union-attr]
        if cell.closed:
            continue
        for e in cell.entries:
            lid = names.get(norm(e.level))
            if lid:
                occ.append(Occurrence(cell.slot_id, lid, max(1, e.groups)))
    return occ


def _available(ws: Workspace, place_ids: list[str], occs: list[Occurrence], period: str) -> bool:
    """Chaque occurrence a-t-elle au moins un de ces lieux disponible sur toute la période ?"""
    places = {p.id: p for p in ws.places}
    segs = PERIODS[period]
    return all(any(all(seg in places[pid].availability.get(o.slot_id, []) for seg in segs)
                   for pid in place_ids if pid in places) for o in occs)


def diagnose(ws: Workspace) -> list[Issue]:
    """Détecte les causes évidentes d'impossibilité, niveau par niveau."""
    cfg = ws.settings
    issues: list[Issue] = []
    sports = {s.id: s for s in ws.sports}
    occ = _occurrences(ws)
    for lv in ws.levels:
        mine = [o for o in occ if o.level_id == lv.id]
        if not mine:
            continue
        periods = MODE_PERIODS[lv.mode]
        lsports = [sports[s] for s in dict.fromkeys(lv.sport_ids) if s in sports]
        prio = [s for s in lsports if s.priority]
        if cfg.priority_required and len(prio) > len(periods):
            issues.append(issue("too_many_priority", target=lv.id, target_type="level",
                                level=lv.name, count=len(prio), periods=len(periods)))
        if not cfg.allow_repeat and len(lsports) < len(periods):
            issues.append(issue("not_enough_sports", target=lv.id, target_type="level",
                                level=lv.name, count=len(lsports), periods=len(periods)))
        too_few = any(o.groups < cfg.barrette_min_groups for o in mine)
        usable: set[str] = set()
        for sp in lsports:
            if sp.barrette and too_few:
                issues.append(issue("barrette_single", severity="warning", target=sp.id, target_type="sport",
                                    sport=sp.name, level=lv.name, min=cfg.barrette_min_groups))
                continue
            possible = [p for p in periods if _available(ws, sp.place_ids, mine, p)]
            usable.update(possible)
            if sp.priority and cfg.priority_required and not possible:
                issues.append(issue("priority_impossible", target=sp.id, target_type="sport",
                                    sport=sp.name, level=lv.name))
            for p in periods:
                if p not in possible:
                    issues.append(issue("sport_period_unavailable", severity="warning", target=sp.id,
                                        target_type="sport", sport=sp.name, level=lv.name, period=p))
        if len(usable) < len(periods):
            issues.append(issue("level_blocked", target=lv.id, target_type="level",
                                level=lv.name, count=len(periods) - len(usable)))
    return issues


class _Model:
    def __init__(self, ws: Workspace):
        self.ws = ws
        cfg = ws.settings
        m = self.m = cp_model.CpModel()
        sports = self.sports = {s.id: s for s in ws.sports}
        places = self.places = {p.id: p for p in ws.places}
        self.occ = _occurrences(ws)
        winter = set(ws.settings.winter_segments)
        self.x: dict[tuple[str, str, str], cp_model.IntVar] = {}
        self.n: dict[tuple[int, str, str], cp_model.IntVar] = {}
        self.b: dict[tuple[int, str, str], cp_model.IntVar] = {}
        self.v: dict[tuple[str, str], cp_model.IntVar] = {}
        self.prio_used: list = []
        self.levels = [lv for lv in ws.levels if any(o.level_id == lv.id for o in self.occ)]
        self.mode = {lv.id: lv.mode for lv in self.levels}

        for lv in self.levels:
            periods = MODE_PERIODS[lv.mode]
            mine = [(i, o) for i, o in enumerate(self.occ) if o.level_id == lv.id]
            too_few = any(o.groups < cfg.barrette_min_groups for _, o in mine)
            lsports = [s for s in dict.fromkeys(lv.sport_ids)
                       if s in sports and not (sports[s].barrette and too_few)]
            for p in periods:
                for s in lsports:
                    self.x[lv.id, p, s] = m.new_bool_var(f"x_{lv.id}_{p}_{s}")
                m.add_exactly_one(self.x[lv.id, p, s] for s in lsports)
            for s in lsports:
                used = sum(self.x[lv.id, p, s] for p in periods)
                if len(lsports) < len(periods) and cfg.allow_repeat:
                    m.add(used >= 1)
                else:
                    m.add(used <= 1)
                    if sports[s].priority:
                        if cfg.priority_required:
                            m.add(used == 1)
                        else:
                            self.prio_used.append(used)

            for p in periods:
                segs = PERIODS[p]
                is_winter = cfg.winter_rule != "off" and bool(winter.intersection(segs))
                outdoor_uses = []
                for oi, o in mine:
                    cand = []
                    for pid, place in places.items():
                        supporting = [self.x[lv.id, p, s] for s in lsports if pid in sports[s].place_ids]
                        if not supporting:
                            continue
                        if not all(seg in place.availability.get(o.slot_id, []) for seg in segs):
                            continue
                        if place.outdoor and is_winter and cfg.winter_rule == "hard":
                            continue
                        b = m.new_bool_var(f"b_{oi}_{p}_{pid}")
                        n = m.new_int_var(0, o.groups, f"n_{oi}_{p}_{pid}")
                        m.add(n <= o.groups * b)
                        m.add(n >= b)
                        m.add(b <= sum(supporting))
                        self.b[oi, p, pid], self.n[oi, p, pid] = b, n
                        cand.append(pid)
                        if place.outdoor and is_winter:
                            outdoor_uses.append(b)
                    m.add(sum(self.n[oi, p, pid] for pid in cand) == o.groups)
                    # barrette : toutes les classes dans un seul lieu
                    barr = [self.x[lv.id, p, s] for s in lsports if sports[s].barrette]
                    if barr and cand:
                        m.add(sum(self.b[oi, p, pid] for pid in cand) <= 1 + len(cand) * (1 - sum(barr)))
                if outdoor_uses:
                    v = m.new_bool_var(f"v_{lv.id}_{p}")
                    for bb in outdoor_uses:
                        m.add(v >= bb)
                    self.v[lv.id, p] = v

        # capacité des lieux, créneau par créneau et segment par segment
        load: dict[tuple[str, str, str], list] = {}
        for (oi, p, pid), n in self.n.items():
            for seg in PERIODS[p]:
                load.setdefault((pid, self.occ[oi].slot_id, seg), []).append(n)
        for (pid, _, _), terms in load.items():
            m.add(sum(terms) <= max(1, places[pid].capacity))

        self.winter_count = sum(self.v.values())
        self.prio_count = sum(self.prio_used)

    def extract(self, solver, index: int) -> Solution:
        plan: dict[str, dict[str, str]] = {}
        for (lid, p, s), var in self.x.items():
            if solver.value(var):
                plan.setdefault(lid, {})[p] = s
        assignments = []
        for oi, o in enumerate(self.occ):
            for p in MODE_PERIODS[self.mode[o.level_id]]:
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
                params = {"level": names[lid], "place": ", ".join(self.places[x].name for x in pids), "period": p}
                violations.append(Violation(rule="winter_outdoor", levelId=lid, period=p, placeId=pids[0],
                                            params=params, message=render("winter_outdoor", params)))
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
        if key in self.seen:  # pragma: no cover - dépend de l'ordre d'exploration du solveur
            return
        self.seen.add(key)
        self.solutions.append(sol)
        if len(self.solutions) >= self.limit:
            self.truncated = True
            self.stop_search()


def _optimum(ws: Workspace) -> tuple[int, int] | None:
    """(écarts d'hiver minimaux, puis nombre maximal de sports prioritaires placés)."""
    model = _Model(ws)
    big = len(model.prio_used) + 1
    model.m.minimize(model.winter_count * big - model.prio_count)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    if solver.solve(model.m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return int(solver.value(model.winter_count)), int(solver.value(model.prio_count))


def _enumerate(ws: Workspace, winter: int, prio: int) -> _Collector:
    model = _Model(ws)
    model.m.add(model.winter_count == winter)
    model.m.add(model.prio_count == prio)
    solver = cp_model.CpSolver()
    solver.parameters.enumerate_all_solutions = True
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    col = _Collector(model, ws.settings.max_solutions)
    solver.solve(model.m, col)
    return col


def solve(ws: Workspace) -> SolveResult:
    issues = validate(ws)
    if blocking(issues):
        return SolveResult(status="infeasible", issues=issues)

    best = _optimum(ws)
    if best is None:
        diag = diagnose(ws)
        if not blocking(diag):
            diag.append(issue("no_solution", target_type="place"))
        return SolveResult(status="infeasible", issues=issues + diag)

    winter, prio = best
    if winter > ws.settings.max_winter_violations:
        return SolveResult(status="infeasible", issues=issues + [
            issue("winter_limit", target_type="place", count=winter, max=ws.settings.max_winter_violations)])

    col = _enumerate(ws, winter, prio)
    if winter:
        issues = issues + [issue("relaxed", severity="warning", count=winter)]
    return SolveResult(status="relaxed" if winter else "ok", solutions=col.solutions,
                       totalFound=len(col.solutions), truncated=col.truncated, issues=issues)
