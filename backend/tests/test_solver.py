"""Comportement du solveur : placement des séances, rythmes, lieux et règles."""

from __future__ import annotations

from app.solver import candidates, diagnose, fmt_minutes, solve
from app.validation import validate

from .factories import grid, level, place, slots, sport, workspace


def codes(issues):
    return {i.code for i in issues}


def single(tt=None, cycle=None, groups=1, mode="semestre", **settings):
    tt = tt or grid()
    ws = workspace(tt, [level("L", ["s"], mode=mode, cycle=cycle, groups=groups)], [sport("s", ["gym"])],
                   [place("gym", slots(tt), capacity=groups)], **settings)
    return ws


# --------------------------------------------------------------- candidates

def test_fmt_minutes():
    assert fmt_minutes(120) == "2h" and fmt_minutes(90) == "1h30"


def test_candidates_respect_duration_contiguity_and_closed_cells():
    tt = grid(days=3, minutes=[60, 60, 60], closed={(0, 1)}, missing={(1, 1)})
    ws = single(tt)
    two = {(c.day, c.row, c.span) for c in candidates(ws, 120)}
    # jour 0 : ligne 1 fermée ; jour 1 : trou ; jour 2 : deux suites possibles
    assert two == {(2, 0, 2), (2, 1, 2)}
    assert {(c.day, c.row) for c in candidates(ws, 60)} == {(0, 0), (0, 2), (1, 0), (1, 2), (2, 0), (2, 1), (2, 2)}
    assert candidates(ws, 90) == []  # aucune somme exacte
    assert candidates(ws, 240) == []


def test_candidates_with_merged_cell():
    tt = grid(days=1, minutes=[60, 60, 30], spans={(0, 0): 2})
    cands = candidates(single(tt), 150)
    assert [(c.row, c.span, c.slots, sorted(c.cells)) for c in cands] == [(0, 3, ["0-0", "0-2"],
                                                                          [(0, 0), (0, 1), (0, 2)])]


def test_solver_places_session_on_exact_run():
    tt = grid(days=2, minutes=[60, 60, 60], closed={(0, 1)})
    res = solve(single(tt, cycle=[[120]]))
    assert res.status == "ok" and res.solutions
    for sol in res.solutions:
        for a in sol.assignments:
            assert (a.day, a.span, a.minutes) == (1, 2, 120)
            assert a.slot_id == f"1-{a.row}"
    assert {a.row for s in res.solutions for a in s.assignments} == {0, 1}


# --------------------------------------------------------------- week structure

def test_sessions_of_a_week_on_different_days():
    res = solve(single(grid(days=2, minutes=[60, 60]), cycle=[[60, 60]]))
    assert res.status == "ok"
    for sol in res.solutions:
        s1 = [a for a in sol.assignments if a.period == "S1"]
        assert len(s1) == 2 and s1[0].day != s1[1].day


def test_same_day_allowed_no_overlap():
    tt = grid(days=1, minutes=[60, 60])
    assert "too_many_sessions" in codes(diagnose(single(tt, cycle=[[60, 60]])))
    assert solve(single(tt, cycle=[[60, 60]])).status == "infeasible"
    res = solve(single(tt, cycle=[[60, 60]], sameDayAllowed=True))
    assert res.status == "ok"
    for sol in res.solutions:
        rows = sorted(a.row for a in sol.assignments if a.period == "S1")
        assert rows == [0, 1]
    # sessions de durées différentes qui ne peuvent pas se chevaucher
    res = solve(single(grid(days=1, minutes=[60, 60, 60]), cycle=[[60, 120]], sameDayAllowed=True))
    assert res.status == "ok"
    for sol in res.solutions:
        cells = [set(range(a.row, a.row + a.span)) for a in sol.assignments if a.period == "S1"]
        assert not cells[0] & cells[1]
    assert solve(single(tt, cycle=[[60, 120]], sameDayAllowed=True)).status == "infeasible"


def test_two_week_cycle_with_different_durations():
    res = solve(single(grid(days=1, minutes=[60] * 4), cycle=[[120], [240]]))
    assert res.status == "ok"
    sol = res.solutions[0]
    assert sol.weeks == 2
    spans = {(a.week, a.span, a.minutes) for a in sol.assignments}
    assert spans == {(0, 2, 120), (1, 4, 240)}


def test_three_week_cycle_with_empty_week():
    res = solve(single(cycle=[[60], [], [60]]))
    assert res.status == "ok"
    assert res.solutions[0].weeks == 3
    assert {a.week for a in res.solutions[0].assignments} == {0, 2}


def _two_levels(cycle_a, cycle_b):
    tt = grid(days=1, minutes=[60])
    return workspace(tt, [level("A", ["s"], mode="semestre", cycle=cycle_a),
                          level("B", ["s"], mode="semestre", cycle=cycle_b)],
                     [sport("s", ["gym"])], [place("gym", slots(tt))])


def test_cycles_conflict_only_on_shared_real_week():
    # A : semaines réelles 0, 2, 4 ; B (cycle 3, semaine C) : 2, 5 -> semaine 2 commune
    res = solve(_two_levels([[60], []], [[], [], [60]]))
    assert res.status == "infeasible" and codes(res.issues) == {"place_overloaded"}
    # A : 1, 3 ; B : 0 (cycle 4) -> jamais ensemble
    res = solve(_two_levels([[], [60]], [[60], [], [], []]))
    assert res.status == "ok" and res.solutions[0].weeks == 4
    # même cycle, semaines alternées
    assert solve(_two_levels([[60], []], [[], [60]])).status == "ok"


def test_capacity_per_place():
    tt = grid(days=1, minutes=[60])
    ws = workspace(tt, [level("A", ["s"], mode="semestre"), level("B", ["s"], mode="semestre")],
                   [sport("s", ["gym"])], [place("gym", slots(tt))])
    assert solve(ws).status == "infeasible"
    ws.places[0].capacity = 2
    res = solve(ws)
    assert res.status == "ok"
    assert all(a.placements[0].place_id == "gym" for a in res.solutions[0].assignments)


# --------------------------------------------------------------- groups & places

def test_barrette_keeps_groups_together():
    tt = grid(days=2, minutes=[60])
    ws = workspace(tt, [level("L", ["b"], mode="semestre", groups=2)], [sport("b", ["p1", "p2"], barrette=True)],
                   [place("p1", slots(tt), capacity=2), place("p2", ["0-0"], capacity=2)])
    res = solve(ws)
    assert res.status == "ok"
    for sol in res.solutions:
        for a in sol.assignments:
            assert len(a.placements) == 1 and a.placements[0].groups == 2


def test_barrette_single_warning():
    tt = grid(days=1, minutes=[60])
    ws = workspace(tt, [level("L", ["b", "s"], mode="semestre")],
                   [sport("b", ["gym"], barrette=True), sport("s", ["gym"])], [place("gym", slots(tt))])
    diag = diagnose(ws)
    assert [(i.code, i.severity) for i in diag] == [("barrette_single", "warning")]
    res = solve(ws)
    assert res.status == "ok" and all(s.plan["L"] == {"S1": "s", "S2": "s"} for s in res.solutions)


def _split(rule, n_places=2, **settings):
    tt = grid(days=1, minutes=[60])
    pids = [f"p{i}" for i in range(n_places)]
    return workspace(tt, [level("L", ["s"], mode="semestre", groups=2)], [sport("s", pids)],
                     [place(p, slots(tt), capacity=2) for p in pids], separatePlacesRule=rule, **settings)


def test_separate_places_hard():
    res = solve(_split("hard"))
    assert res.status == "ok"
    for a in res.solutions[0].assignments:
        assert sorted((p.place_id, p.groups) for p in a.placements) == [("p0", 1), ("p1", 1)]
    diag = diagnose(_split("hard", n_places=1))
    assert ("separate_impossible", "warning") in [(i.code, i.severity) for i in diag]
    assert "level_blocked" in codes(diag)
    assert solve(_split("hard", n_places=1)).status == "infeasible"


def test_separate_places_soft_and_limit():
    res = solve(_split("soft"))
    assert res.status == "ok" and not res.solutions[0].violations
    res = solve(_split("soft", n_places=1, maxSeparateViolations=2))
    assert res.status == "relaxed"
    assert "relaxed" in codes(res.issues)
    viol = res.solutions[0].violations
    assert {v.rule for v in viol} == {"same_place"} and len(viol) == 2
    res = solve(_split("soft", n_places=1, maxSeparateViolations=1))
    assert res.status == "infeasible" and codes(res.issues) == {"separate_limit"}
    assert res.issues[0].params == {"count": 2, "max": 1}


def test_separate_places_soft_ignores_barrette():
    ws = _split("soft", n_places=1)
    ws.sports[0].barrette = True
    res = solve(ws)
    assert res.status == "ok" and not res.solutions[0].violations
    assert res.solutions[0].assignments[0].placements[0].groups == 2


def test_separate_places_off():
    res = solve(_split("off", n_places=1))
    assert res.status == "ok" and not res.solutions[0].violations
    assert res.solutions[0].assignments[0].placements[0].groups == 2


# --------------------------------------------------------------- winter

def _winter(rule, **settings):
    tt = grid(days=1, minutes=[60])
    return workspace(tt, [level("L", ["foot"])], [sport("foot", ["field"])],
                     [place("field", slots(tt), outdoor=True)], winterRule=rule, **settings)


def test_winter_soft_relaxed():
    res = solve(_winter("soft"))
    assert res.status == "relaxed"
    sol = res.solutions[0]
    assert [(v.rule, v.period, v.place_id) for v in sol.violations] == [("winter_outdoor", "T2", "field")]
    assert sol.violations[0].params["place"] == "Field"


def test_winter_soft_limit_and_hard_and_off():
    res = solve(_winter("soft", maxWinterViolations=0))
    assert res.status == "infeasible" and codes(res.issues) == {"winter_limit"}
    res = solve(_winter("hard"))
    assert res.status == "infeasible" and codes(res.issues) == {"level_alone_impossible"}
    res = solve(_winter("off"))
    assert res.status == "ok" and not res.solutions[0].violations


def test_winter_soft_prefers_indoor():
    tt = grid(days=1, minutes=[60])
    ws = workspace(tt, [level("L", ["foot", "gym"])], [sport("foot", ["field"]), sport("gym", ["hall"])],
                   [place("field", slots(tt), outdoor=True), place("hall", slots(tt))], winterRule="hard")
    res = solve(ws)
    assert res.status == "ok"
    assert all(s.plan["L"]["T2"] == "gym" for s in res.solutions)
    ws.settings.winter_rule = "soft"
    ws.places.append(place("unused", slots(tt)))
    res = solve(ws)
    assert res.status == "ok" and all(s.plan["L"]["T2"] == "gym" and not s.violations for s in res.solutions)


# --------------------------------------------------------------- sports choice

def _choice(sports, places=None, **settings):
    tt = grid(days=1, minutes=[60])
    places = places or [place("gym", slots(tt), capacity=1)]
    return workspace(tt, [level("L", [s.id for s in sports])], sports, places, **settings)


def test_priority_required():
    sp = [sport("a", ["gym"]), sport("b", ["gym"]), sport("c", ["gym"]), sport("p", ["gym"], priority=True)]
    res = solve(_choice(sp, maxSolutions=50))
    assert res.status == "ok"
    assert all("p" in s.plan["L"].values() for s in res.solutions)
    assert all(len(set(s.plan["L"].values())) == 3 for s in res.solutions)


def test_priority_impossible_and_too_many():
    sp = [sport("a", ["gym"]), sport("p", ["ghost_place", "closed"], priority=True)]
    places = [place("gym", ["0-0"]), place("closed", {"0-0": []})]
    diag = diagnose(_choice(sp, places))
    assert {"priority_impossible", "sport_period_unavailable"} <= codes(diag)
    sp = [sport(x, ["gym"], priority=True) for x in "abcd"]
    assert "too_many_priority" in codes(diagnose(_choice(sp)))
    assert solve(_choice(sp)).status == "infeasible"


def test_priority_preferred():
    sp = [sport(x, ["gym"], priority=True) for x in "abcd"]
    res = solve(_choice(sp, priorityRequired=False, maxSolutions=3))
    assert res.status == "ok" and not codes(diagnose(_choice(sp, priorityRequired=False)))
    assert all(len(set(s.plan["L"].values())) == 3 for s in res.solutions)
    # prioritaire disponible seulement au T1 : placé au T1 quand c'est possible
    tt = grid(days=1, minutes=[60])
    sp = [sport("a", ["gym"]), sport("b", ["gym"]), sport("c", ["gym"]), sport("p", ["q1"], priority=True)]
    places = [place("gym", slots(tt)), place("q1", {"0-0": ["Q1"]})]
    res = solve(_choice(sp, places, priorityRequired=False, maxSolutions=20))
    assert res.status == "ok" and all(s.plan["L"]["T1"] == "p" for s in res.solutions)


def test_allow_repeat():
    sp = [sport(x, ["gym"]) for x in "abc"]
    res = solve(_choice(sp, allowRepeat=False, maxSolutions=10))
    assert res.status == "ok" and all(len(set(s.plan["L"].values())) == 3 for s in res.solutions)
    res = solve(_choice(sp[:2], allowRepeat=False))
    assert res.status == "infeasible" and "not_enough_sports" in codes(res.issues)
    res = solve(_choice(sp[:2], maxSolutions=20))
    assert res.status == "ok" and all(set(s.plan["L"].values()) == {"a", "b"} for s in res.solutions)


def test_truncated_and_distinct():
    sp = [sport(x, ["gym"]) for x in "abc"]
    res = solve(_choice(sp, maxSolutions=2))
    assert res.truncated and res.total_found == 2
    assert [s.index for s in res.solutions] == [0, 1]


# --------------------------------------------------------------- diagnostics

def test_diagnose_duration_and_period():
    tt = grid(days=1, minutes=[60])
    res = solve(single(tt, cycle=[[90]]))
    assert res.status == "infeasible"
    dur = next(i for i in res.issues if i.code == "duration_impossible")
    assert dur.params["duration"] == "1h30"
    ws = workspace(tt, [level("L", ["a", "b"])], [sport("a", ["gym"]), sport("b", ["gym"])],
                   [place("gym", {"0-0": ["Q1"]})])
    diag = diagnose(ws)
    assert [i.code for i in diag].count("sport_period_unavailable") == 4
    blocked = next(i for i in diag if i.code == "level_blocked")
    assert blocked.params["count"] == 2


def test_validation_codes():
    tt = grid(days=1, minutes=[60, 0])
    ws = workspace(tt, [level("A", ["s"], cycle=[[]]), level("a ", ["zz"], name="A "), level("B", ["t"])],
                   [sport("s", ["ghost"]), sport("t", ["gym"])], [place("gym", {})])
    found = codes(validate(ws))
    assert found == {"row_no_duration", "level_no_session", "level_no_sport", "sport_no_place",
                     "place_never_available", "duplicate_level"}
    res = solve(ws)
    assert res.status == "infeasible" and not res.solutions
    assert codes(validate(workspace(None, [], [], []))) == {"no_timetable"}
    assert codes(validate(workspace(tt, [], [], []))) == {"row_no_duration", "no_level"}


def test_fill_direction_preference():
    from .factories import grid, level, place, slots, sport, workspace

    tt = grid(days=3, minutes=[60, 60, 60])
    ws = workspace(tt, [level("6e", ["a"], cycle=[[60]])], [sport("a", ["gym"])], [place("gym", slots(tt))])
    first = solve(ws).solutions[0].assignments[0]
    assert (first.day, first.row) == (0, 0)  # haut gauche par défaut : lundi 8h
    ws.preferences.fill_vertical, ws.preferences.fill_horizontal = "bottom", "right"
    first = solve(ws).solutions[0].assignments[0]
    assert (first.day, first.row) == (2, 2)
    ws.preferences.fill_vertical, ws.preferences.fill_horizontal = "none", "none"
    res = solve(ws)
    assert all(s.fill_cost == 0 for s in res.solutions)


def test_explain_names_the_overloaded_place():
    from .factories import grid, level, place, slots, sport, workspace

    tt = grid(days=2, minutes=[60, 60])
    ws = workspace(tt, [level("6e", ["a"], cycle=[[60, 60]]), level("5e", ["a"], cycle=[[60, 60]]),
                        level("4e", ["a"], cycle=[[60]])], [sport("a", ["gym"])], [place("gym", slots(tt))])
    res = solve(ws)
    assert res.status == "infeasible"
    over = [i for i in res.issues if i.code == "place_overloaded"]
    assert len(over) == 1 and over[0].target == "gym" and over[0].params["capacity"] == 1
    assert over[0].params["sports"] == "A" and len(str(over[0].params["levels"]).split(", ")) >= 2


def test_impossible_sports_are_ignored_so_others_can_repeat():
    """Cas réel (dump du 24/09) : un sport impossible ne doit pas empêcher la répétition des autres."""
    from .factories import grid, level, place, slots, sport, workspace

    tt = grid(days=2, minutes=[60, 60])
    ok = slots(tt)
    ws = workspace(
        tt,
        [level("6e", ["foot", "tennis", "bad", "hand"], groups=2)],
        [sport("foot", ["gym", "pis"]), sport("tennis", ["terrain"]), sport("bad", ["gym"], barrette=True),
         sport("hand", ["gym"])],
        # terrain : jamais une case libre toute une période ; gym de capacité 1 (barrette de 2 impossible)
        [place("gym", ok), place("pis", ok), place("terrain", {ok[0]: ["Q1"], ok[1]: ["Q2"]})],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert set(res.solutions[0].plan["6e"].values()) == {"foot"}  # tennis, bad et hand (1 seul lieu) ignorés
    warned = {i.params.get("sport") for i in res.issues if i.severity == "warning"}
    assert {"Tennis", "Hand", "Bad"} <= warned
    assert any(i.code == "barrette_capacity" for i in res.issues)
