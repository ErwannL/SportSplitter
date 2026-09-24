import { describe, expect, it } from "vitest";
import { readyWs } from "../test/utils";
import { readiness, slotId, targetLink } from "./readiness";

describe("readiness (compléments)", () => {
  it("sport inconnu, niveaux sans sport, pas de timetable", () => {
    const ws = readyWs();
    ws.levels[0].sportIds = ["ghost"];
    const s = readiness(ws);
    expect(s.problems.some((p) => p.key === "ready.noSport")).toBe(true);
    expect(readiness({ ...ws, timetable: null, levels: [], sports: [], places: [] }).places).toBe(false);
  });
  it("sport avec lieu inexistant", () => {
    const ws = readyWs();
    ws.sports[0].placeIds = ["nope"];
    expect(readiness(ws).sports).toBe(false);
  });
  it("targetLink", () => {
    const ws = readyWs();
    expect(slotId(1, 2)).toBe("1-2");
    expect(targetLink()).toBe("/");
    expect(targetLink("level", "l6", ws)).toBe("/classes?focus=l6");
    expect(targetLink("place", "p1", ws)).toBe("/lieux?focus=p1");
    expect(targetLink("sport", "zz", ws)).toBe("/sports");
    expect(targetLink("sport", "s1")).toBe("/sports");
    expect(targetLink("sport", null, ws)).toBe("/sports");
  });
});
