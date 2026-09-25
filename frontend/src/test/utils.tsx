import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { useStore } from "../store";
import type { Me, Workspace } from "../types";
import { defaultPreferences, defaultSettings } from "../store";

export function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

export function renderAt(ui: ReactElement, path = "/", route = "*") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={<>{ui}<Loc /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

export const jsonRes = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(["x"])) }) as Response;

export function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const f = vi.fn(impl);
  vi.stubGlobal("fetch", f);
  return f;
}

export const readyWs = (): Workspace => ({
  timetable: {
    days: ["Lundi", "Mardi"],
    rows: [
      { label: "M1", start: "8h", end: "10h", minutes: 120 },
      { label: "M2", start: "", end: "", minutes: 60 },
    ],
    cells: [
      { day: 0, row: 0, rowSpan: 1, closed: false, entries: [{ level: "6e", groups: 2 }] },
      { day: 1, row: 0, rowSpan: 1, closed: false, entries: [{ level: "5e", groups: 1 }] },
      { day: 0, row: 1, rowSpan: 1, closed: true, entries: [] },
    ],
    fileName: "edt.xlsx",
  },
  levels: [
    { id: "l6", name: "6e", mode: "trimestre", sportIds: ["s1"], groups: 2, cycle: [[120]] },
    { id: "l5", name: "5e", mode: "semestre", sportIds: ["s1"], groups: 1, cycle: [[60], [120]] },
  ],
  sports: [{ id: "s1", name: "Foot", priority: true, barrette: false, placeIds: ["p1"] }],
  places: [
    { id: "p1", name: "Stade", color: "#10b981", outdoor: true, capacity: 2, availability: { "0-0": ["Q1", "Q2", "Q3", "Q4"] } },
  ],
  settings: defaultSettings(),
  preferences: defaultPreferences(),
});

export const setWs = (ws: Workspace) => useStore.setState({ ws });

export const ADMIN_ME: Me = {
  sub: "u1",
  email: "admin@example.org",
  name: "Admin",
  role: "admin",
  permissions: ["edit_workspace", "edit_rules"],
};

export const profMe = (): Me => ({ sub: "u2", email: "prof@example.org", name: "Prof", role: "prof", permissions: [] });
