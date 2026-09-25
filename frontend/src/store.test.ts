import { describe, expect, it, vi } from "vitest";
import { jsonRes, mockFetch, readyWs } from "./test/utils";
import type { Level } from "./types";
import { emptyWorkspace, hydrate, LEGACY_LOCAL_KEY, localKey, newId, readLocal, useStore } from "./store";

const st = () => useStore.getState();

describe("store", () => {
  it("load depuis l'API", async () => {
    mockFetch(async () => jsonRes({ levels: [] }));
    await st().load("u1");
    expect(st().loaded).toBe(true);
    expect(st().save).toBe("saved");
    expect(st().ws.settings.maxSolutions).toBe(200);
  });
  it("load hors ligne : localStorage ou vide", async () => {
    await st().load("u1");
    expect(st().save).toBe("offline");
    expect(st().ws).toEqual(emptyWorkspace());
    localStorage.setItem("sportsplitter.workspace.u1", JSON.stringify({ ws: readyWs(), dirty: false }));
    await st().load("u1");
    expect(st().ws.levels).toHaveLength(2);
  });
  it("sauvegarde différée et flush", async () => {
    vi.useFakeTimers();
    const f = mockFetch(async () => jsonRes({}));
    useStore.setState({ sub: "u1" });
    st().addLevel();
    expect(st().save).toBe("saving");
    expect(st().ws.levels[0]).toMatchObject({ name: "Niveau 1", groups: 1, cycle: [[120]] });
    await vi.advanceTimersByTimeAsync(600);
    expect(f).toHaveBeenCalledTimes(1);
    expect(st().save).toBe("saved");
    expect(JSON.parse(localStorage.getItem("sportsplitter.workspace.u1")!)).toMatchObject({ dirty: false, ws: { levels: [{ name: "Niveau 1" }] } });
    await st().flush();
    expect(f).toHaveBeenCalledTimes(1);
    mockFetch(async () => jsonRes({}, 500));
    st().addLevel("X");
    await st().flush();
    expect(st().save).toBe("offline");
    expect(JSON.parse(localStorage.getItem("sportsplitter.workspace.u1")!).dirty).toBe(true);
  });
  it("sans utilisateur : rien n'est écrit localement", async () => {
    mockFetch(async () => jsonRes({}));
    st().addLevel();
    await st().flush();
    expect(localStorage.length).toBe(0);
  });
  it("migration de l'ancienne clé", () => {
    localStorage.setItem(LEGACY_LOCAL_KEY, JSON.stringify(readyWs()));
    expect(readLocal("u1")).toEqual({ ws: readyWs(), dirty: false });
    expect(localStorage.getItem(LEGACY_LOCAL_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(localKey("u1"))!).ws.levels).toHaveLength(2);
    // copie utilisateur existante : pas écrasée, ancienne clé supprimée quand même
    localStorage.setItem(localKey("u2"), JSON.stringify({ ws: { levels: [] }, dirty: true }));
    localStorage.setItem(LEGACY_LOCAL_KEY, JSON.stringify(readyWs()));
    expect(readLocal("u2")).toEqual({ ws: { levels: [] }, dirty: true });
    expect(localStorage.getItem(LEGACY_LOCAL_KEY)).toBeNull();
    expect(readLocal("u3")).toBeNull();
  });
  it("load : copie locale non synchronisée reprise et renvoyée", async () => {
    const local = { ...readyWs(), settings: { ...readyWs().settings, timeLimit: 3 } };
    localStorage.setItem(localKey("u1"), JSON.stringify({ ws: local, dirty: true }));
    const f = mockFetch(async (_u, init) => jsonRes(init?.method === "PUT" ? {} : { levels: [], settings: { timeLimit: 9 } }));
    await st().load("u1");
    expect(st().ws.levels).toHaveLength(2);
    expect(st().ws.settings.timeLimit).toBe(9);
    const put = f.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(put[1]!.body as string).levels).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(localKey("u1"))!).dirty).toBe(false);
    expect(st().save).toBe("saved");
  });
  it("clear", () => {
    useStore.setState({ ws: readyWs(), sub: "u1", loaded: true });
    st().addLevel("Z");
    st().clear();
    expect(st()).toMatchObject({ ws: emptyWorkspace(), sub: "", loaded: false, save: "idle" });
  });
  it("mutations", () => {
    useStore.setState({ ws: readyWs() });
    st().addLevels(["6E", "4e"]);
    expect(st().ws.levels.map((l) => l.name)).toEqual(["6e", "5e", "4e"]);
    expect(st().ws.levels[2]).toMatchObject({ groups: 1, cycle: [[120]] });
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
    expect(hydrate({}).settings).toMatchObject({ sameDayAllowed: false, separatePlacesRule: "hard", maxSeparateViolations: 1 });
    expect(hydrate({}).levels).toEqual([]);
    const old = { id: "a", name: "6e", mode: "trimestre", sportIds: [] } as unknown as Level;
    expect(hydrate({ levels: [old, readyWs().levels[1]] }).levels).toEqual([
      { ...old, groups: 1, cycle: [[120]] },
      readyWs().levels[1],
    ]);
  });
});
