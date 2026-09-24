import { describe, expect, it } from "vitest";
import { defaultSettings } from "../store";
import { isReady, readiness } from "./readiness";
import type { Workspace } from "../types";

const base = (): Workspace => ({
  timetable: {
    days: ["Lundi"],
    rows: [{ label: "8h", start: "8h", end: "10h", minutes: 120 }],
    cells: [{ day: 0, row: 0, rowSpan: 1, closed: false, entries: [{ level: "6eme", groups: 1 }, { level: "6EME ", groups: 1 }] }],
    fileName: "t.xlsx",
  },
  levels: [{ id: "l", name: "6eme", mode: "trimestre", sportIds: ["s"], groups: 1, cycle: [[120]] }],
  sports: [{ id: "s", name: "Bad", priority: false, barrette: false, placeIds: ["p"] }],
  places: [{ id: "p", name: "Gym", color: "#000000", outdoor: false, capacity: 1, availability: { "0-0": ["Q1"] } }],
  settings: defaultSettings(),
});

describe("readiness", () => {
  it("est prêt quand tout est configuré", () => {
    expect(isReady(readiness(base()))).toBe(true);
  });
  it("bloque sans emploi du temps", () => {
    const s = readiness({ ...base(), timetable: null });
    expect(s.timetable).toBe(false);
    expect(isReady(s)).toBe(false);
  });
  it("signale l'absence de niveau", () => {
    const s = readiness({ ...base(), levels: [] });
    expect(s.levels).toBe(false);
    expect(s.problems.map((p) => p.key)).toContain("ready.noLevel");
  });
  it("signale un niveau sans séance", () => {
    const ws = base();
    ws.levels[0].cycle = [[], []];
    const s = readiness(ws);
    expect(s.levels).toBe(false);
    expect(s.problems[0]).toMatchObject({ key: "ready.noSession", params: { level: "6eme" }, target: "l", targetType: "level" });
    ws.levels[0].cycle = [[], [60]];
    expect(readiness(ws).levels).toBe(true);
  });
  it("signale un sport sans lieu et un lieu jamais disponible", () => {
    const ws = base();
    ws.places[0].availability = {};
    expect(readiness(ws).places).toBe(false);
    ws.sports[0].placeIds = [];
    expect(readiness(ws).sports).toBe(false);
  });
});
