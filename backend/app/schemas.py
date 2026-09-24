"""Modèles de données partagés entre l'API, le parseur Excel et le solveur."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# L'année est découpée en 4 segments atomiques pour pouvoir combiner
# trimestres et semestres : le 2e trimestre est coupé en deux par la fin du
# 1er semestre.
Segment = Literal["Q1", "Q2", "Q3", "Q4"]
SEGMENTS: list[str] = ["Q1", "Q2", "Q3", "Q4"]
SEGMENT_LABELS = {
    "Q1": "Sept – Nov",
    "Q2": "Déc – Janv",
    "Q3": "Févr – Mars",
    "Q4": "Avr – Juin",
}

Mode = Literal["trimestre", "semestre"]
PERIODS: dict[str, list[str]] = {
    "T1": ["Q1"],
    "T2": ["Q2", "Q3"],
    "T3": ["Q4"],
    "S1": ["Q1", "Q2"],
    "S2": ["Q3", "Q4"],
}
MODE_PERIODS: dict[str, list[str]] = {
    "trimestre": ["T1", "T2", "T3"],
    "semestre": ["S1", "S2"],
}
PERIOD_LABELS = {
    "T1": "1er trimestre",
    "T2": "2e trimestre",
    "T3": "3e trimestre",
    "S1": "1er semestre",
    "S2": "2e semestre",
}


class Camel(BaseModel):
    model_config = {"populate_by_name": True}


class TimeRow(Camel):
    label: str
    start: str = ""
    end: str = ""


class Entry(Camel):
    level: str
    groups: int = 1


class Cell(Camel):
    day: int
    row: int
    row_span: int = Field(1, alias="rowSpan")
    closed: bool = False
    entries: list[Entry] = []

    @property
    def slot_id(self) -> str:
        return f"{self.day}-{self.row}"


class Timetable(Camel):
    days: list[str]
    rows: list[TimeRow]
    cells: list[Cell]
    file_name: str = Field("", alias="fileName")


class Level(Camel):
    id: str
    name: str
    mode: Mode = "trimestre"
    sport_ids: list[str] = Field(default_factory=list, alias="sportIds")


class Sport(Camel):
    id: str
    name: str
    priority: bool = False
    barrette: bool = False
    place_ids: list[str] = Field(default_factory=list, alias="placeIds")


class Place(Camel):
    id: str
    name: str
    color: str = "#6366f1"
    outdoor: bool = False
    capacity: int = 1
    # slotId -> segments où le lieu est disponible
    availability: dict[str, list[Segment]] = Field(default_factory=dict)


class Settings(Camel):
    """Règles métier de l'algorithme, modifiables par un administrateur."""

    winter_segments: list[Segment] = Field(default_factory=lambda: ["Q2", "Q3"], alias="winterSegments")
    # soft : évité, au plus ``max_winter_violations`` écarts ; hard : interdit ; off : ignoré
    winter_rule: Literal["soft", "hard", "off"] = Field("soft", alias="winterRule")
    max_winter_violations: int = Field(1, ge=0, alias="maxWinterViolations")
    priority_required: bool = Field(True, alias="priorityRequired")
    barrette_min_groups: int = Field(2, ge=2, alias="barretteMinGroups")
    allow_repeat: bool = Field(True, alias="allowRepeat")
    max_solutions: int = Field(200, ge=1, le=5000, alias="maxSolutions")
    time_limit: float = Field(20.0, gt=0, le=600, alias="timeLimit")


class Workspace(Camel):
    timetable: Timetable | None = None
    levels: list[Level] = Field(default_factory=list)
    sports: list[Sport] = Field(default_factory=list)
    places: list[Place] = Field(default_factory=list)
    settings: Settings = Field(default_factory=Settings)


# ---------- Résultats ----------


class Placement(Camel):
    place_id: str = Field(alias="placeId")
    groups: int


class Assignment(Camel):
    slot_id: str = Field(alias="slotId")
    level_id: str = Field(alias="levelId")
    period: str
    sport_id: str = Field(alias="sportId")
    placements: list[Placement]


TargetType = Literal["level", "sport", "place", "timetable"]


class Violation(Camel):
    rule: str
    message: str
    params: dict[str, str | int] = Field(default_factory=dict)
    level_id: str | None = Field(None, alias="levelId")
    period: str | None = None
    place_id: str | None = Field(None, alias="placeId")


class Solution(Camel):
    index: int
    plan: dict[str, dict[str, str]]  # levelId -> period -> sportId
    assignments: list[Assignment]
    violations: list[Violation] = []


class Issue(Camel):
    severity: Literal["error", "warning"] = "error"
    code: str
    message: str
    target: str | None = None
    target_type: TargetType | None = Field(None, alias="targetType")
    params: dict[str, str | int] = Field(default_factory=dict)


class SolveResult(Camel):
    status: Literal["ok", "relaxed", "infeasible"]
    solutions: list[Solution] = []
    total_found: int = Field(0, alias="totalFound")
    truncated: bool = False
    issues: list[Issue] = []
