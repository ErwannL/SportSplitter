import io
import json
import zipfile
from datetime import UTC, datetime

from app.debug import dump_zip, summary
from app.schemas import Workspace

from .factories import grid, level, place, slots, sport, workspace


def _files(data: bytes) -> dict[str, str]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {n: z.read(n).decode() for n in z.namelist()}


def test_summary_without_timetable_and_dangling_refs():
    ws = Workspace(levels=[level("6e", ["gone"])], sports=[sport("a", ["nowhere"], priority=True, barrette=True)])
    text = summary(ws)
    assert "GRILLE : aucune" in text
    assert "<sport supprimé gone>" in text and "<lieu supprimé nowhere>" in text
    assert "prioritaire barrette" in text


def test_dump_infeasible_lists_errors():
    tt = grid(days=1, minutes=[60], closed={(0, 0)})
    ws = workspace(tt, [level("6e", ["a"], cycle=[[60], []])], [sport("a", ["gym"])], [place("gym", slots(tt))])
    name, data = dump_zip(ws, datetime(2026, 9, 24, 20, 15, 3, tzinfo=UTC))
    assert name == "dump_2026-09-24_20-15-03.zip"
    files = _files(data)
    assert set(files) == {"LISEZMOI.txt", "erreurs.txt", "avertissements.txt", "donnees.json", "resultat.json"}
    assert "Statut du calcul : infeasible" in files["LISEZMOI.txt"]
    assert "#" in files["LISEZMOI.txt"] and "SA: 1h | SB: rien" in files["LISEZMOI.txt"]
    assert "[duration_impossible]" in files["erreurs.txt"] and "(cible level:6e)" in files["erreurs.txt"]
    assert "[place_never_available]" in files["avertissements.txt"]
    assert json.loads(files["donnees.json"])["levels"][0]["id"] == "6e"


def test_dump_relaxed_lists_warnings_and_violations():
    tt = grid(days=1, minutes=[60])
    ws = workspace(tt, [level("6e", ["a"])], [sport("a", ["ext"])], [place("ext", slots(tt), outdoor=True)])
    files = _files(dump_zip(ws)[1])
    assert files["erreurs.txt"] == "(aucun)\n"
    assert "[relaxed]" in files["avertissements.txt"] and "[winter_outdoor]" in files["avertissements.txt"]
    assert "extérieur" in files["LISEZMOI.txt"] and "(tronqué)" not in files["LISEZMOI.txt"]


def test_dump_endpoint(client):
    r = client.get("/api/debug/dump")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    assert "dump_" in r.headers["content-disposition"]
    assert "[no_timetable]" in _files(r.content)["erreurs.txt"]
