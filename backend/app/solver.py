"""Construction de l'emploi du temps d'EPS par programmation par contraintes (OR-Tools CP-SAT).

Entrées : une grille vide (créneaux ouverts / fermés), des niveaux avec leur
rythme (cycle de 1 à 4 semaines, chaque semaine = liste de séances avec leur
durée), des sports et des lieux avec leurs disponibilités.

Modèle
------
* Une **séance** = (niveau, semaine du cycle, numéro). Elle occupe un
  « candidat » : une suite de créneaux contigus d'un même jour dont la durée
  totale est exactement celle de la séance. Le créneau est le même toute l'année.
* ``x[l, p, s]`` : le niveau ``l`` pratique le sport ``s`` pendant la période ``p``.
* ``u[q, c, p, pl]`` : nombre de classes de la séance ``q``, placée au candidat
  ``c``, qui vont dans le lieu ``pl`` pendant la période ``p``.

Deux séances ne se gênent que si elles peuvent tomber la même semaine réelle :
on déroule le cycle commun (PPCM des cycles, au plus 12 semaines).

Règles réglables (``Settings``) : hiver, sports prioritaires, répétition des
sports, séances le même jour, classes simultanées dans des lieux différents.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import lcm

from ortools.sat.python import cp_model

from .messages import issue, render
from .schemas import (MODE_PERIODS, PERIODS, Assignment, Issue, Level, Placement, Solution, SolveResult, Violation,
                      Workspace)
from .validation import blocking, validate


def fmt_minutes(m: int) -> str:
    return f"{m // 60}h{m % 60:02d}" if m % 60 else f"{m // 60}h"


@dataclass
class Candidate:
    day: int
    row: int  # première ligne couverte
    span: int  # nombre de lignes couvertes
    slots: list[str]  # identifiants des cellules (pour les disponibilités des lieux)
    cells: set[tuple[int, int]] = field(default_factory=set)  # (jour, ligne) couverts


@dataclass
class Session:
    level: Level
    week: int
    index: int
    minutes: int
    candidates: list[Candidate]


def candidates(ws: Workspace, minutes: int) -> list[Candidate]:
    """Toutes les suites de cellules ouvertes contiguës d'un jour dont la durée vaut ``minutes``."""
    tt = ws.timetable
    out: list[Candidate] = []
    for d in range(len(tt.days)):  # type: ignore[union-attr]
        col = sorted((c for c in tt.cells if c.day == d), key=lambda c: c.row)  # type: ignore[union-attr]
        for i, first in enumerate(col):
            total, run = 0, []
            for c in col[i:]:
                if c.closed or (run and c.row != run[-1].row + run[-1].row_span):
                    break
                run.append(c)
                total += sum(tt.rows[r].minutes for r in range(c.row, c.row + c.row_span))  # type: ignore[union-attr]
                if total >= minutes:
                    break
            if run and total == minutes:
                cells = {(d, r) for c in run for r in range(c.row, c.row + c.row_span)}
                out.append(Candidate(d, first.row, sum(c.row_span for c in run), [c.slot_id for c in run], cells))
    return out


def sessions(ws: Workspace) -> list[Session]:
    cache: dict[int, list[Candidate]] = {}
    out = []
    for lv in ws.levels:
        for w, week in enumerate(lv.cycle):
            for k, minutes in enumerate(week):
                if minutes not in cache:
                    cache[minutes] = candidates(ws, minutes)
                out.append(Session(lv, w, k, minutes, cache[minutes]))
    return out


def _available(ws: Workspace, place_ids: list[str], cand: Candidate, period: str) -> bool:
    places = {p.id: p for p in ws.places}
    return any(all(seg in places[pid].availability.get(sid, []) for sid in cand.slots for seg in PERIODS[period])
               for pid in place_ids if pid in places)


def fill_cost(ws: Workspace, cand: Candidate) -> int:
    """Coût d'un candidat selon le sens de remplissage préféré : le jour compte avant l'heure."""
    pref = ws.preferences
    rows, days = len(ws.timetable.rows), len(ws.timetable.days)  # type: ignore[union-attr]
    h = {"left": cand.day, "right": days - 1 - cand.day, "none": 0}[pref.fill_horizontal]
    v = {"top": cand.row, "bottom": rows - (cand.row + cand.span), "none": 0}[pref.fill_vertical]
    return h * rows + v


def diagnose(ws: Workspace) -> list[Issue]:
    """Causes évidentes d'impossibilité, niveau par niveau."""
    cfg = ws.settings
    issues: list[Issue] = []
    sports = {s.id: s for s in ws.sports}
    all_sessions = sessions(ws)
    for lv in ws.levels:
        mine = [q for q in all_sessions if q.level.id == lv.id]
        periods = MODE_PERIODS[lv.mode]
        for q in mine:
            if not q.candidates:
                issues.append(issue("duration_impossible", target=lv.id, target_type="level",
                                    level=lv.name, duration=fmt_minutes(q.minutes)))
        if not cfg.same_day_allowed:
            for w, week in enumerate(lv.cycle):
                if len(week) > len(ws.timetable.days):  # type: ignore[union-attr]
                    issues.append(issue("too_many_sessions", target=lv.id, target_type="level", level=lv.name,
                                        count=len(week), days=len(ws.timetable.days)))  # type: ignore[union-attr]
        lsports = [sports[s] for s in dict.fromkeys(lv.sport_ids) if s in sports]
        prio = [s for s in lsports if s.priority]
        if cfg.priority_required and len(prio) > len(periods):
            issues.append(issue("too_many_priority", target=lv.id, target_type="level",
                                level=lv.name, count=len(prio), periods=len(periods)))
        if not cfg.allow_repeat and len(lsports) < len(periods):
            issues.append(issue("not_enough_sports", target=lv.id, target_type="level",
                                level=lv.name, count=len(lsports), periods=len(periods)))
        if any(not q.candidates for q in mine):
            continue
        usable: set[str] = set()
        for sp in lsports:
            if sp.barrette and lv.groups < cfg.barrette_min_groups:
                issues.append(issue("barrette_single", severity="warning", target=sp.id, target_type="sport",
                                    sport=sp.name, level=lv.name, min=cfg.barrette_min_groups))
                continue
            if (not sp.barrette and lv.groups > 1 and cfg.separate_places_rule == "hard"
                    and len([pid for pid in sp.place_ids if pid in {p.id for p in ws.places}]) < lv.groups):
                issues.append(issue("separate_impossible", severity="warning", target=sp.id, target_type="sport",
                                    sport=sp.name, level=lv.name, count=lv.groups))
                continue
            possible = [p for p in periods if all(any(_available(ws, sp.place_ids, c, p) for c in q.candidates)
                                                  for q in mine)]
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
    def __init__(self, ws: Workspace, soft_capacity: bool = False):
        self.ws = ws
        cfg = ws.settings
        m = self.m = cp_model.CpModel()
        sports = {s.id: s for s in ws.sports}
        places = self.places = {p.id: p for p in ws.places}
        winter = set(cfg.winter_segments)
        self.sessions = sessions(ws)
        self.weeks = lcm(*(len(lv.cycle) for lv in ws.levels))
        self.x: dict[tuple[str, str, str], cp_model.IntVar] = {}
        self.y: dict[tuple[int, int], cp_model.IntVar] = {}  # (séance, candidat) choisi
        self.u: dict[tuple[int, int, str, str], cp_model.IntVar] = {}  # (séance, candidat, période, lieu)
        self.v: dict[tuple[str, str], cp_model.IntVar] = {}  # hiver, par (niveau, période)
        self.sep: list = []  # classes simultanées dans un même lieu
        self.prio_used: list = []

        for lv in ws.levels:
            periods = MODE_PERIODS[lv.mode]
            too_few = lv.groups < cfg.barrette_min_groups
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

            mine = [(qi, q) for qi, q in enumerate(self.sessions) if q.level.id == lv.id]
            for qi, q in mine:
                ys = [m.new_bool_var(f"y_{qi}_{ci}") for ci in range(len(q.candidates))]
                for ci, var in enumerate(ys):
                    self.y[qi, ci] = var
                m.add_exactly_one(ys)
            # séances d'une même semaine : pas de chevauchement, jours différents si demandé
            for w in range(len(lv.cycle)):
                week = [(qi, q) for qi, q in mine if q.week == w]
                by_cell: dict[tuple[int, int], list] = {}
                by_day: dict[int, list] = {}
                for qi, q in week:
                    for ci, cand in enumerate(q.candidates):
                        by_day.setdefault(cand.day, []).append(self.y[qi, ci])
                        for cell in cand.cells:
                            by_cell.setdefault(cell, []).append(self.y[qi, ci])
                for group in (by_cell.values() if cfg.same_day_allowed else by_day.values()):
                    m.add_at_most_one(group)
                # symétrie : deux séances de même durée sont interchangeables
                for (qa, a), (qb, b) in ((p1, p2) for i, p1 in enumerate(week) for p2 in week[i + 1:]):
                    if a.minutes == b.minutes:
                        m.add(sum(ci * self.y[qa, ci] for ci in range(len(a.candidates)))
                              < sum(ci * self.y[qb, ci] for ci in range(len(b.candidates))))

            barrette = {p: [self.x[lv.id, p, s] for s in lsports if sports[s].barrette] for p in periods}
            for p in periods:
                segs = PERIODS[p]
                is_winter = cfg.winter_rule != "off" and bool(winter.intersection(segs))
                outdoor_uses = []
                for qi, q in mine:
                    for ci, cand in enumerate(q.candidates):
                        cand_places = []
                        for pid, place in places.items():
                            supporting = [self.x[lv.id, p, s] for s in lsports if pid in sports[s].place_ids]
                            if not supporting:
                                continue
                            if not all(seg in place.availability.get(sid, []) for sid in cand.slots for seg in segs):
                                continue
                            if place.outdoor and is_winter and cfg.winter_rule == "hard":
                                continue
                            n = m.new_int_var(0, lv.groups, f"u_{qi}_{ci}_{p}_{pid}")
                            m.add(n <= lv.groups * sum(supporting))
                            self.u[qi, ci, p, pid] = n
                            cand_places.append(pid)
                            if place.outdoor and is_winter:
                                used = m.new_bool_var("")
                                m.add(n <= lv.groups * used)
                                outdoor_uses.append(used)
                            if lv.groups > 1:
                                # hors barrette, une classe par lieu (ou écart compté si règle souple)
                                limit = [lv.groups * b for b in barrette[p]]
                                if cfg.separate_places_rule == "hard":
                                    m.add(n <= 1 + sum(limit))
                                elif cfg.separate_places_rule == "soft":
                                    shared = m.new_bool_var("")
                                    m.add(n <= 1 + sum(limit) + lv.groups * shared)
                                    self.sep.append(shared)
                        m.add(sum(self.u[qi, ci, p, pid] for pid in cand_places) == lv.groups * self.y[qi, ci])
                        # barrette : toutes les classes dans un seul lieu
                        if barrette[p] and lv.groups > 1 and cand_places:
                            flags = []
                            for pid in cand_places:
                                f = m.new_bool_var("")
                                m.add(self.u[qi, ci, p, pid] <= lv.groups * f)
                                flags.append(f)
                            m.add(sum(flags) <= 1 + len(flags) * (1 - sum(barrette[p])))
                if outdoor_uses:
                    v = m.new_bool_var(f"v_{lv.id}_{p}")
                    for used in outdoor_uses:
                        m.add(v >= used)
                    self.v[lv.id, p] = v

        # capacité des lieux : par semaine réelle du cycle commun, cellule et segment de l'année
        self.load: dict[tuple, list] = {}
        for (qi, ci, p, pid), n in self.u.items():
            q = self.sessions[qi]
            cycle = len(q.level.cycle)
            for real in range(q.week, self.weeks, cycle):
                for cell in q.candidates[ci].cells:
                    for seg in PERIODS[p]:
                        self.load.setdefault((pid, real, cell, seg), []).append((n, q.level.name))
        # en mode diagnostic, la capacité peut être dépassée (dépassement minimisé)
        self.overflow: dict[tuple, cp_model.IntVar] = {}
        for key, terms in self.load.items():
            cap = places[key[0]].capacity
            if soft_capacity:
                self.overflow[key] = m.new_int_var(0, sum(q.level.groups for q in self.sessions), "")
                m.add(sum(n for n, _ in terms) <= cap + self.overflow[key])
            else:
                m.add(sum(n for n, _ in terms) <= cap)

        self.winter_count = sum(self.v.values())
        self.sep_count = sum(self.sep)
        self.prio_count = sum(self.prio_used)
        self.fill = sum(fill_cost(ws, self.sessions[qi].candidates[ci]) * var for (qi, ci), var in self.y.items())

    def extract(self, solver, index: int) -> Solution:
        plan: dict[str, dict[str, str]] = {}
        for (lid, p, s), var in self.x.items():
            if solver.value(var):
                plan.setdefault(lid, {})[p] = s
        assignments = []
        for qi, q in enumerate(self.sessions):
            ci = next(ci for ci in range(len(q.candidates)) if solver.value(self.y[qi, ci]))
            cand = q.candidates[ci]
            for p in MODE_PERIODS[q.level.mode]:
                pls = [Placement(placeId=pid, groups=solver.value(n)) for (a, b, pp, pid), n in self.u.items()
                       if a == qi and b == ci and pp == p and solver.value(n) > 0]
                assignments.append(Assignment(slotId=cand.slots[0], levelId=q.level.id, session=q.index, week=q.week,
                                              day=cand.day, row=cand.row, span=cand.span, minutes=q.minutes,
                                              period=p, sportId=plan[q.level.id][p], placements=pls))
        violations = []
        names = {lv.id: lv.name for lv in self.ws.levels}
        for (lid, p), v in self.v.items():
            if solver.value(v):
                pids = sorted({a.placements[i].place_id for a in assignments if a.level_id == lid and a.period == p
                               for i in range(len(a.placements)) if self.places[a.placements[i].place_id].outdoor})
                params = {"level": names[lid], "place": ", ".join(self.places[x].name for x in pids), "period": p}
                violations.append(Violation(rule="winter_outdoor", levelId=lid, period=p, placeId=pids[0],
                                            params=params, message=render("winter_outdoor", params)))
        for a in assignments if self.ws.settings.separate_places_rule == "soft" else []:
            for pl in a.placements:
                if pl.groups > 1 and not any(s.barrette for s in self.ws.sports if s.id == a.sport_id):
                    params = {"level": names[a.level_id], "place": self.places[pl.place_id].name, "period": a.period}
                    violations.append(Violation(rule="same_place", levelId=a.level_id, period=a.period,
                                                placeId=pl.place_id, params=params,
                                                message=render("same_place", params)))
        cost = sum(fill_cost(self.ws, self.sessions[qi].candidates[ci]) for (qi, ci), var in self.y.items()
                   if solver.value(var))
        return Solution(index=index, plan=plan, weeks=self.weeks, fillCost=cost, assignments=assignments,
                        violations=violations)


class _Collector(cp_model.CpSolverSolutionCallback):
    def __init__(self, model: _Model, limit: int):
        super().__init__()
        self.model, self.limit = model, limit
        self.solutions: list[Solution] = []
        self.seen: set[tuple] = set()
        self.truncated = False

    def on_solution_callback(self):
        sol = self.model.extract(self, len(self.solutions))
        key = tuple(sorted((a.level_id, a.week, a.day, a.row, a.span, a.period, a.sport_id,
                            tuple(sorted((p.place_id, p.groups) for p in a.placements)))
                           for a in sol.assignments))
        if key in self.seen:  # pragma: no cover - dépend de l'ordre d'exploration du solveur
            return
        self.seen.add(key)
        self.solutions.append(sol)
        if len(self.solutions) >= self.limit:
            self.truncated = True
            self.stop_search()


def _optimum(ws: Workspace) -> tuple[int, int, int, int, dict] | None:
    """Optimum lexicographique : écarts d'hiver, lieux partagés, sports prioritaires placés, puis sens de remplissage."""
    model = _Model(ws)
    big = len(model.prio_used) + 1
    bigger = big * (len(model.sep) + 1)
    model.m.minimize(model.winter_count * bigger + model.sep_count * big - model.prio_count)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    if solver.solve(model.m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    winter, sep, prio = (int(solver.value(model.winter_count)), int(solver.value(model.sep_count)),
                         int(solver.value(model.prio_count)))
    model.m.add(model.winter_count == winter)
    model.m.add(model.sep_count == sep)
    model.m.add(model.prio_count == prio)
    model.m.minimize(model.fill)
    solver.solve(model.m)
    hint = {key: solver.value(var) for key, var in model.y.items()}
    return winter, sep, prio, int(solver.value(model.fill)), hint


def _enumerate(ws: Workspace, winter: int, sep: int, prio: int, fill: int, hint: dict) -> _Collector:
    model = _Model(ws)
    for key, value in hint.items():  # part du meilleur placement trouvé
        model.m.add_hint(model.y[key], value)
    model.m.add(model.winter_count == winter)
    model.m.add(model.sep_count == sep)
    model.m.add(model.prio_count == prio)
    # autour du meilleur remplissage : chaque séance peut s'en écarter d'environ un jour
    model.m.add(model.fill <= fill + len(model.sessions) * len(ws.timetable.rows))  # type: ignore[union-attr]
    solver = cp_model.CpSolver()
    solver.parameters.enumerate_all_solutions = True
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    col = _Collector(model, ws.settings.max_solutions)
    solver.solve(model.m, col)
    col.solutions.sort(key=lambda sol: sol.fill_cost)
    for i, sol in enumerate(col.solutions):
        sol.index = i
    return col


def explain(ws: Workspace) -> list[Issue]:
    """Pourquoi aucun planning n'existe : niveau impossible seul, ou lieu surchargé (qui, où, quand)."""
    out: list[Issue] = []
    for lv in ws.levels:
        alone = ws.model_copy(update={"levels": [lv]})
        if _optimum(alone) is None:
            out.append(issue("level_alone_impossible", target=lv.id, target_type="level", level=lv.name))
    if out:
        return out

    model = _Model(ws, soft_capacity=True)
    model.m.minimize(sum(model.overflow.values()))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = ws.settings.time_limit
    # chaque niveau est faisable seul et seule la capacité relie les niveaux : ce modèle n'échoue qu'en cas de
    # temps de calcul dépassé
    if solver.solve(model.m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):  # pragma: no cover
        return [issue("no_solution", target_type="place")]
    tt = ws.timetable
    seg_fr = {"Q1": "sept–nov", "Q2": "déc–janv", "Q3": "févr–mars", "Q4": "avr–juin"}
    seen: dict[str, Issue] = {}
    for (pid, _, (day, row), seg), var in sorted(model.overflow.items(), key=lambda kv: (kv[0][2], kv[0][3])):
        if pid in seen or not solver.value(var):
            continue
        place = model.places[pid]
        levels = sorted({name for n, name in model.load[(pid, _, (day, row), seg)] if solver.value(n)})
        sports = sorted({s.name for s in ws.sports if pid in s.place_ids})
        seen[pid] = issue("place_overloaded", target=pid, target_type="place", place=place.name,
                          levels=", ".join(levels), day=tt.days[day], time=tt.rows[row].start,  # type: ignore[union-attr]
                          segment=seg_fr[seg], capacity=place.capacity, sports=", ".join(sports))
    return list(seen.values()) or [issue("no_solution", target_type="place")]


def solve(ws: Workspace) -> SolveResult:
    issues = validate(ws)
    if blocking(issues):
        return SolveResult(status="infeasible", issues=issues)

    diag = diagnose(ws)
    if blocking(diag):
        return SolveResult(status="infeasible", issues=issues + diag)

    best = _optimum(ws)
    if best is None:
        return SolveResult(status="infeasible", issues=issues + diag + explain(ws))

    winter, sep, prio, fill, hint = best
    cfg = ws.settings
    limits = []
    if winter > cfg.max_winter_violations:
        limits.append(issue("winter_limit", target_type="place", count=winter, max=cfg.max_winter_violations))
    if sep > cfg.max_separate_violations:
        limits.append(issue("separate_limit", target_type="place", count=sep, max=cfg.max_separate_violations))
    if limits:
        return SolveResult(status="infeasible", issues=issues + limits)

    col = _enumerate(ws, winter, sep, prio, fill, hint)
    if winter or sep:
        issues = issues + [issue("relaxed", severity="warning", count=winter + sep)]
    return SolveResult(status="relaxed" if winter or sep else "ok", solutions=col.solutions,
                       totalFound=len(col.solutions), truncated=col.truncated, issues=issues)
