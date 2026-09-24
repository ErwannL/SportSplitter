import { describe, expect, it, vi } from "vitest";
import { jsonRes, mockFetch, readyWs } from "./test/utils";
import { emptyWorkspace, hydrate, missingLevels, newId, useStore } from "./store";

const st = () => useStore.getState();

describe("store", () => {
  it("load depuis l'API", async () => {
    mockFetch(async () => jsonRes({ levels: [] }));
    await st().load();
    expect(st().loaded).toBe(true);
    expect(st().save).toBe("saved");
    expect(st().ws.settings.maxSolutions).toBe(200);
  });
  it("load hors ligne : localStorage ou vide", async () => {
    await st().load();
    expect(st().save).toBe("offline");
    expect(st().ws).toEqual(emptyWorkspace());
    localStorage.setItem("sportsplitter.workspace", JSON.stringify(readyWs()));
    await st().load();
    expect(st().ws.levels).toHaveLength(2);
  });
  it("sauvegarde différée et flush", async () => {
    vi.useFakeTimers();
    const f = mockFetch(async () => jsonRes({}));
    st().addLevel();
    expect(st().save).toBe("saving");
    expect(st().ws.levels[0].name).toBe("Niveau 1");
    await vi.advanceTimersByTimeAsync(600);
    expect(f).toHaveBeenCalledTimes(1);
    expect(st().save).toBe("saved");
    expect(localStorage.getItem("sportsplitter.workspace")).toContain("Niveau 1");
    await st().flush();
    expect(f).toHaveBeenCalledTimes(1);
    mockFetch(async () => jsonRes({}, 500));
    st().addLevel("X");
    await st().flush();
    expect(st().save).toBe("offline");
  });
  it("mutations", () => {
    useStore.setState({ ws: readyWs() });
    st().addLevels(["6E", "4e"]);
    expect(st().ws.levels.map((l) => l.name)).toEqual(["6e", "5e", "4e"]);
    st().updateLevel("l6", { name: "Sixième" });
    st().updateLevel("nope", { name: "?" });
    st().removeLevel("l5");
    expect(st().addSport(" foot ")).toBe("s1");
    const s2 = st().addSport("Tennis");
    st().updateSport(s2, { priority: true });
    st().updateSport("s1", { barrette: true });
    expect(st().addPlace("stade")).toBe("p1");
    const p2 = st().addPlace("Gym");
    st().updatePlace(p2, { capacity: 3 });
    st().updatePlace("p1", { capacity: 4 });
    st().removePlace("p1");
    expect(st().ws.sports[0].placeIds).toEqual([]);
    st().removeSport("s1");
    expect(st().ws.levels[0].sportIds).toEqual([]);
    st().updateSettings({ timeLimit: 5 });
    expect(st().ws.settings.timeLimit).toBe(5);
    st().setTimetable(null);
    st().setResult({ status: "ok", solutions: [], totalFound: 0, truncated: false, issues: [] });
    expect(st().result).not.toBeNull();
    st().reset();
    expect(st().ws).toEqual(emptyWorkspace());
  });
  it("helpers", () => {
    expect(newId("a")).not.toBe(newId("a"));
    expect(hydrate({}).settings.winterRule).toBe("soft");
    const ws = readyWs();
    ws.levels = [];
    expect(missingLevels(ws)).toEqual(["6e", "5e"]);
  });
});
