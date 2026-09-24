import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore, withSaturday } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { ConfigurationPage, fillCost, fillOrder } from "./Configuration";

describe("fillOrder", () => {
  it("haut gauche : lundi 8h d'abord, puis la journée, puis mardi", () => {
    const o = fillOrder({ fillVertical: "top", fillHorizontal: "left", saturday: false });
    expect(o[0][0]).toBe(1);
    expect(o[1][0]).toBe(2);
    expect(o[0][1]).toBe(7);
  });
  it("bas seul : toutes les fins de journée d'abord", () => {
    const o = fillOrder({ fillVertical: "bottom", fillHorizontal: "none", saturday: false });
    expect(o[5]).toEqual([1, 1, 1, 1, 1]);
    expect(o[0][0]).toBe(6);
  });
  it("haut droite : vendredi 8h d'abord ; indifférent partout = tout égal", () => {
    expect(fillOrder({ fillVertical: "top", fillHorizontal: "right", saturday: false })[0][4]).toBe(1);
    expect(new Set(fillOrder({ fillVertical: "none", fillHorizontal: "none", saturday: false }).flat())).toEqual(new Set([1]));
    expect(fillCost({ fillVertical: "bottom", fillHorizontal: "right", saturday: false }, 4, 5)).toBe(0);
  });
});

describe("ConfigurationPage", () => {
  it("modifie le sens de remplissage", async () => {
    renderAt(<ConfigurationPage />);
    const u = userEvent.setup();
    expect(screen.getByRole("radio", { name: /Le matin d'abord/ })).toHaveAttribute("aria-checked", "true");
    await u.click(screen.getByRole("radio", { name: /Le soir d'abord/ }));
    await u.click(screen.getByRole("radio", { name: /Vendredi d'abord/ }));
    expect(useStore.getState().ws.preferences).toEqual({ fillVertical: "bottom", fillHorizontal: "right", saturday: false });
    await u.click(screen.getAllByRole("radio", { name: /Indifférent/ })[0]);
    await u.click(screen.getAllByRole("radio", { name: /Indifférent/ })[1]);
    expect(screen.getByTestId("fill-preview").textContent).toContain("1");
  });
});

describe("samedi", () => {
  it("ajoute et retire la colonne Samedi de la grille et de l'aperçu", async () => {
    setWs(readyWs());
    renderAt(<ConfigurationPage />);
    const u = userEvent.setup();
    const cols = () => useStore.getState().ws.timetable!.days;
    await u.click(screen.getByRole("switch", { name: "Cours le samedi" }));
    expect(cols().at(-1)).toBe("Samedi");
    const tt = useStore.getState().ws.timetable!;
    expect(tt.cells.filter((c) => c.day === tt.days.length - 1)).toHaveLength(tt.rows.length);
    expect(screen.getByTestId("fill-preview").children).toHaveLength(6 * 7);
    expect(fillOrder({ fillVertical: "top", fillHorizontal: "right", saturday: true })[0][5]).toBe(1);
    await u.click(screen.getByRole("switch", { name: "Cours le samedi" }));
    expect(cols()).not.toContain("Samedi");
  });
  it("withSaturday : déjà présent, absent, retrait d'un samedi au milieu, et sans grille", () => {
    const tt = readyWs().timetable!;
    expect(withSaturday(tt, false)).toBe(tt);
    const on = withSaturday(tt, true);
    expect(withSaturday(on, true)).toBe(on);
    const mid = { ...tt, days: ["Samedi", ...tt.days], cells: [{ day: 0, row: 0, rowSpan: 1, closed: false, entries: [] }, ...tt.cells.map((c) => ({ ...c, day: c.day + 1 }))] };
    expect(withSaturday(mid, false).cells).toEqual(tt.cells);
    useStore.setState({ ws: { ...readyWs(), timetable: null } });
    useStore.getState().updatePreferences({ saturday: true });
    expect(useStore.getState().ws.timetable).toBeNull();
  });
});
