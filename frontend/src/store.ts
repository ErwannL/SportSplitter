import { create } from "zustand";
import { api } from "./lib/api";
import { norm, timetableLevels } from "./lib/readiness";
import type { Level, Place, SolveResult, Sport, Timetable, Workspace } from "./types";

export const PLACE_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16",
];

export const LEVEL_PRESETS: Record<string, string[]> = {
  Primaire: ["CP", "CE1", "CE2", "CM1", "CM2"],
  Collège: ["6e", "5e", "4e", "3e"],
  Lycée: ["2nde", "1re", "Terminale"],
  Université: ["L1", "L2", "L3", "M1", "M2"],
};

const LOCAL_KEY = "sportsplitter.workspace";

export const emptyWorkspace = (): Workspace => ({
  timetable: null,
  levels: [],
  sports: [],
  places: [],
  settings: { winterSegments: ["Q2", "Q3"], maxSolutions: 200, timeLimit: 20 },
});

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

type SaveState = "idle" | "saving" | "saved" | "offline";

interface State {
  ws: Workspace;
  loaded: boolean;
  save: SaveState;
  result: SolveResult | null;
  load: () => Promise<void>;
  setTimetable: (t: Timetable | null) => void;
  addLevel: (name?: string) => string;
  addLevels: (names: string[]) => void;
  updateLevel: (id: string, patch: Partial<Level>) => void;
  removeLevel: (id: string) => void;
  addSport: (name: string) => string;
  updateSport: (id: string, patch: Partial<Sport>) => void;
  removeSport: (id: string) => void;
  addPlace: (name: string) => string;
  updatePlace: (id: string, patch: Partial<Place>) => void;
  removePlace: (id: string) => void;
  setResult: (r: SolveResult | null) => void;
  reset: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set, get) => {
  /** Modifie l'espace de travail, invalide le résultat et sauvegarde (différé). */
  const mutate = (fn: (ws: Workspace) => Workspace) => {
    set({ ws: fn(get().ws), result: null, save: "saving" });
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const ws = get().ws;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(ws));
      try {
        await api.saveWorkspace(ws);
        set({ save: "saved" });
      } catch {
        set({ save: "offline" });
      }
    }, 500);
  };

  return {
    ws: emptyWorkspace(),
    loaded: false,
    save: "idle",
    result: null,

    async load() {
      try {
        const ws = await api.loadWorkspace();
        set({ ws: { ...emptyWorkspace(), ...ws }, loaded: true, save: "saved" });
      } catch {
        const local = localStorage.getItem(LOCAL_KEY);
        set({ ws: local ? { ...emptyWorkspace(), ...JSON.parse(local) } : emptyWorkspace(), loaded: true, save: "offline" });
      }
    },

    setTimetable: (t) => mutate((ws) => ({ ...ws, timetable: t })),

    addLevel(name) {
      const id = newId("lvl");
      mutate((ws) => ({
        ...ws,
        levels: [...ws.levels, { id, name: name ?? `Niveau ${ws.levels.length + 1}`, mode: "trimestre", sportIds: [] }],
      }));
      return id;
    },

    addLevels(names) {
      mutate((ws) => {
        const known = new Set(ws.levels.map((l) => norm(l.name)));
        const extra = names
          .filter((n) => !known.has(norm(n)))
          .map((name): Level => ({ id: newId("lvl"), name, mode: "trimestre", sportIds: [] }));
        return { ...ws, levels: [...ws.levels, ...extra] };
      });
    },

    updateLevel: (id, patch) =>
      mutate((ws) => ({ ...ws, levels: ws.levels.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

    removeLevel: (id) => mutate((ws) => ({ ...ws, levels: ws.levels.filter((l) => l.id !== id) })),

    addSport(name) {
      const existing = get().ws.sports.find((s) => norm(s.name) === norm(name));
      if (existing) return existing.id;
      const id = newId("spt");
      mutate((ws) => ({ ...ws, sports: [...ws.sports, { id, name, priority: false, barrette: false, placeIds: [] }] }));
      return id;
    },

    updateSport: (id, patch) =>
      mutate((ws) => ({ ...ws, sports: ws.sports.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),

    removeSport: (id) =>
      mutate((ws) => ({
        ...ws,
        sports: ws.sports.filter((s) => s.id !== id),
        levels: ws.levels.map((l) => ({ ...l, sportIds: l.sportIds.filter((s) => s !== id) })),
      })),

    addPlace(name) {
      const existing = get().ws.places.find((p) => norm(p.name) === norm(name));
      if (existing) return existing.id;
      const id = newId("plc");
      mutate((ws) => ({
        ...ws,
        places: [
          ...ws.places,
          { id, name, color: PLACE_COLORS[ws.places.length % PLACE_COLORS.length], outdoor: false, capacity: 1, availability: {} },
        ],
      }));
      return id;
    },

    updatePlace: (id, patch) =>
      mutate((ws) => ({ ...ws, places: ws.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

    removePlace: (id) =>
      mutate((ws) => ({
        ...ws,
        places: ws.places.filter((p) => p.id !== id),
        sports: ws.sports.map((s) => ({ ...s, placeIds: s.placeIds.filter((p) => p !== id) })),
      })),

    setResult: (result) => set({ result }),

    reset: () => mutate(() => emptyWorkspace()),
  };
});

export const missingLevels = (ws: Workspace) => {
  const known = new Set(ws.levels.map((l) => norm(l.name)));
  return timetableLevels(ws).filter((n) => !known.has(norm(n)));
};
