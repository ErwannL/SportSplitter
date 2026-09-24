import { create } from "zustand";
import { api } from "./lib/api";
import { placeColor } from "./lib/colors";
import { norm } from "./lib/readiness";
import type { Issue, Level, Place, Preferences, Settings, SolveResult, Sport, Timetable, Workspace } from "./types";

export const LEVEL_PRESETS: Record<string, string[]> = {
  Primaire: ["CP", "CE1", "CE2", "CM1", "CM2"],
  Collège: ["6e", "5e", "4e", "3e"],
  Lycée: ["2nde", "1re", "Terminale"],
  Université: ["L1", "L2", "L3", "M1", "M2"],
};

const LOCAL_KEY = "sportsplitter.workspace";

export const defaultSettings = (): Settings => ({
  winterSegments: ["Q2", "Q3"],
  winterRule: "soft",
  maxWinterViolations: 1,
  priorityRequired: true,
  barretteMinGroups: 2,
  allowRepeat: true,
  sameDayAllowed: false,
  separatePlacesRule: "hard",
  maxSeparateViolations: 1,
  maxSolutions: 200,
  timeLimit: 20,
});

export const defaultPreferences = (): Preferences => ({ fillVertical: "top", fillHorizontal: "left", saturday: false });

export const SATURDAY = "Samedi";

/** Ajoute ou retire la colonne du samedi (cases ouvertes) dans la grille. */
export function withSaturday(tt: Timetable, on: boolean): Timetable {
  const idx = tt.days.findIndex((d) => norm(d) === norm(SATURDAY));
  if (on && idx < 0) {
    const day = tt.days.length;
    return {
      ...tt,
      days: [...tt.days, SATURDAY],
      cells: [...tt.cells, ...tt.rows.map((_, row) => ({ day, row, rowSpan: 1, closed: false, entries: [] }))],
    };
  }
  if (!on && idx >= 0) {
    return {
      ...tt,
      days: tt.days.filter((_, i) => i !== idx),
      cells: tt.cells.filter((c) => c.day !== idx).map((c) => (c.day > idx ? { ...c, day: c.day - 1 } : c)),
    };
  }
  return tt;
}

export const emptyWorkspace = (): Workspace => ({
  timetable: null,
  levels: [],
  sports: [],
  places: [],
  settings: defaultSettings(),
  preferences: defaultPreferences(),
});

/** Complète un espace de travail chargé (anciennes versions sans certains champs). */
export const hydrate = (ws: Partial<Workspace>): Workspace => ({
  ...emptyWorkspace(),
  ...ws,
  levels: (ws.levels ?? []).map((l) => ({ ...l, groups: l.groups ?? 1, cycle: l.cycle ?? [[120]] })),
  settings: { ...defaultSettings(), ...ws.settings },
  preferences: { ...defaultPreferences(), ...ws.preferences },
});

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

type SaveState = "idle" | "saving" | "saved" | "offline";

interface State {
  ws: Workspace;
  loaded: boolean;
  save: SaveState;
  result: SolveResult | null;
  /** Problèmes du dernier calcul impossible ; gardés (marqués « périmés ») après modification. */
  lastIssues: { issues: Issue[]; stale: boolean } | null;
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
  updateSettings: (patch: Partial<Settings>) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  setResult: (r: SolveResult | null) => void;
  /** Sauvegarde immédiatement les modifications en attente (fermeture de l'onglet…). */
  flush: () => Promise<void>;
  reset: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;

export const useStore = create<State>((set, get) => {
  /** Modifie l'espace de travail, invalide le résultat et sauvegarde (différé). */
  const mutate = (fn: (ws: Workspace) => Workspace) => {
    const last = get().lastIssues;
    set({ ws: fn(get().ws), result: null, save: "saving", lastIssues: last && { ...last, stale: true } });
    clearTimeout(timer);
    pending = true;
    timer = setTimeout(flush, 500);
  };

  const flush = async () => {
    clearTimeout(timer);
    if (!pending) return;
    pending = false;
    const ws = get().ws;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ws));
    try {
      await api.saveWorkspace(ws);
      set({ save: "saved" });
    } catch {
      set({ save: "offline" });
    }
  };

  return {
    ws: emptyWorkspace(),
    loaded: false,
    save: "idle",
    result: null,
    lastIssues: null,

    async load() {
      try {
        const ws = await api.loadWorkspace();
        set({ ws: hydrate(ws), loaded: true, save: "saved" });
      } catch {
        const local = localStorage.getItem(LOCAL_KEY);
        set({ ws: hydrate(local ? JSON.parse(local) : {}), loaded: true, save: "offline" });
      }
    },

    setTimetable: (t) => mutate((ws) => ({ ...ws, timetable: t })),

    addLevel(name) {
      const id = newId("lvl");
      mutate((ws) => ({
        ...ws,
        levels: [...ws.levels, { id, name: name ?? `Niveau ${ws.levels.length + 1}`, mode: "trimestre", sportIds: [], groups: 1, cycle: [[120]] }],
      }));
      return id;
    },

    addLevels(names) {
      mutate((ws) => {
        const known = new Set(ws.levels.map((l) => norm(l.name)));
        const extra = names
          .filter((n) => !known.has(norm(n)))
          .map((name): Level => ({ id: newId("lvl"), name, mode: "trimestre", sportIds: [], groups: 1, cycle: [[120]] }));
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
          {
            id,
            name,
            color: placeColor(name, id, ws.places.map((p) => p.color)),
            outdoor: false,
            capacity: 1,
            availability: {},
          },
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

    updatePreferences: (patch) =>
      mutate((ws) => ({
        ...ws,
        preferences: { ...ws.preferences, ...patch },
        timetable: ws.timetable && patch.saturday !== undefined ? withSaturday(ws.timetable, patch.saturday) : ws.timetable,
      })),

    updateSettings: (patch) => mutate((ws) => ({ ...ws, settings: { ...ws.settings, ...patch } })),

    setResult: (result) =>
      set({
        result,
        lastIssues: result?.status === "infeasible" ? { issues: result.issues, stale: false } : result ? null : get().lastIssues,
      }),

    flush,

    reset: () => mutate(() => emptyWorkspace()),
  };
});
