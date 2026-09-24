from app.schemas import PERIODS
from app.solver import solve

from .factories import level, place, sport, timetable, workspace


def _check_capacity(ws, sol):
    places = {p.id: p for p in ws.places}
    use = {}
    for a in sol.assignments:
        for pl in a.placements:
            assert all(seg in places[pl.place_id].availability.get(a.slot_id, []) for seg in PERIODS[a.period])
            for seg in PERIODS[a.period]:
                key = (pl.place_id, a.slot_id, seg)
                use[key] = use.get(key, 0) + pl.groups
    for (pid, _, _), n in use.items():
        assert n <= places[pid].capacity


def test_simple_rotation_uses_each_sport_once():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["bad", "danse", "hand"])],
        [sport("bad", ["gym"]), sport("danse", ["gym"]), sport("hand", ["gym"])],
        [place("gym", ["0-0"])],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert res.total_found == 6  # 3! permutations
    for sol in res.solutions:
        assert sorted(sol.plan["6e"].values()) == ["bad", "danse", "hand"]
        _check_capacity(ws, sol)


def test_place_conflict_forces_different_sports():
    # deux niveaux au même créneau, deux lieux de capacité 1
    ws = workspace(
        timetable({(0, 0): [("6e", 1), ("5e", 1)]}),
        [level("6e", ["nat", "bad"], mode="semestre"), level("5e", ["nat", "bad"], mode="semestre")],
        [sport("nat", ["piscine"]), sport("bad", ["gym"])],
        [place("piscine", ["0-0"]), place("gym", ["0-0"])],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert res.total_found == 2
    for sol in res.solutions:
        assert sol.plan["6e"]["S1"] != sol.plan["5e"]["S1"]
        _check_capacity(ws, sol)


def test_priority_sport_always_chosen():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["a", "b", "c"], mode="semestre")],
        [sport("a", ["gym"]), sport("b", ["gym"]), sport("c", ["gym"], priority=True)],
        [place("gym", ["0-0"])],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert all("c" in s.plan["6e"].values() for s in res.solutions)


def test_barrette_puts_both_classes_in_one_place_and_needs_two():
    ws = workspace(
        timetable({(0, 0): [("4e", 2)]}),
        [level("4e", ["co"], mode="semestre")],
        [sport("co", ["parc", "stade"], barrette=True)],
        [place("parc", ["0-0"], capacity=2), place("stade", ["0-0"], capacity=2)],
    )
    res = solve(ws)
    assert res.status == "ok"
    for sol in res.solutions:
        for a in sol.assignments:
            assert len(a.placements) == 1 and a.placements[0].groups == 2

    single = workspace(timetable({(0, 0): [("4e", 1)]}), ws.levels, ws.sports, ws.places)
    assert solve(single).status == "infeasible"


def test_availability_by_segment():
    # la piscine n'est dispo qu'au 1er trimestre
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["nat", "bad", "hand"])],
        [sport("nat", ["piscine"]), sport("bad", ["gym"]), sport("hand", ["gym"])],
        [place("piscine", {"0-0": ["Q1"]}), place("gym", ["0-0"])],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert all(s.plan["6e"]["T1"] == "nat" for s in res.solutions)


def test_semester_and_trimester_share_a_place_across_segments():
    # 6e (trimestre) et 5e (semestre) au même créneau, un seul lieu
    ws = workspace(
        timetable({(0, 0): [("6e", 1), ("5e", 1)]}),
        [level("6e", ["a"]), level("5e", ["a"], mode="semestre")],
        [sport("a", ["gym"])],
        [place("gym", ["0-0"])],
    )
    assert solve(ws).status == "infeasible"
    ws.places[0].capacity = 2
    assert solve(ws).status == "ok"


def test_winter_outdoor_is_relaxed_with_single_violation():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["foot", "bad", "hand"])],
        [sport("foot", ["ext"]), sport("bad", ["ext"]), sport("hand", ["ext"])],
        [place("ext", ["0-0"], outdoor=True)],
    )
    res = solve(ws)
    assert res.status == "relaxed"
    assert res.solutions
    for sol in res.solutions:
        assert len(sol.violations) == 1
        assert sol.violations[0].period == "T2"


def test_winter_avoided_when_possible():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["foot", "bad", "hand"])],
        [sport("foot", ["ext"]), sport("bad", ["gym"]), sport("hand", ["ext"])],
        [place("ext", ["0-0"], outdoor=True), place("gym", ["0-0"])],
    )
    res = solve(ws)
    assert res.status == "ok"
    assert all(s.plan["6e"]["T2"] == "bad" for s in res.solutions)


def test_infeasible_reports_reason():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)]}),
        [level("6e", ["nat"])],
        [sport("nat", ["piscine"])],
        [place("piscine", {})],
    )
    res = solve(ws)
    assert res.status == "infeasible"
    assert any(i.code == "level_blocked" for i in res.issues)


def test_blocking_config_is_reported_without_solving():
    ws = workspace(timetable({(0, 0): [("inconnu", 1)]}), [], [], [])
    res = solve(ws)
    assert res.status == "infeasible"
    assert res.issues[0].code == "unknown_level"


def test_solution_limit_truncates():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)], (1, 0): [("5e", 1)]}),
        [level("6e", ["a", "b", "c"]), level("5e", ["a", "b", "c"])],
        [sport("a", ["gym"]), sport("b", ["gym"]), sport("c", ["gym"])],
        [place("gym", ["0-0", "1-0"])],
    )
    ws.settings.max_solutions = 5
    res = solve(ws)
    assert res.total_found == 5 and res.truncated


def test_impossible_priority_sport_is_explained():
    ws = workspace(
        timetable({(0, 0): [("6e", 1)], (1, 0): [("6e", 1)]}),
        [level("6e", ["nat", "bad"], mode="semestre")],
        [sport("nat", ["piscine"], priority=True), sport("bad", ["gym"])],
        [place("piscine", ["0-0"]), place("gym", ["0-0", "1-0"])],
    )
    res = solve(ws)
    assert res.status == "infeasible"
    assert any(i.code == "priority_impossible" for i in res.issues)
