import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { ClassesPage } from "./Classes";

const ws = () => useStore.getState().ws;

describe("ClassesPage", () => {
  it("vide, préréglages", async () => {
    renderAt(<ClassesPage />, "/classes");
    const u = userEvent.setup();
    await u.click(screen.getByText("Ajouter un niveau"));
    expect(ws().levels[0].name).toBe("Niveau 1");
    await u.click(screen.getByText("+ Collège"));
    expect(ws().levels).toHaveLength(5);
    await u.click(screen.getByText("Ajouter un niveau"));
    expect(ws().levels[5].name).toBe("Niveau 6");
    expect(screen.queryByText("inutilisé")).toBeNull();
  });
  it("sports, mode, rythme, classes simultanées", async () => {
    const w = readyWs();
    w.levels = [
      { id: "l6", name: "6e", mode: "trimestre", sportIds: ["s1", "ghost"], groups: 1, cycle: [[120]] },
      { id: "lx", name: "Autre", mode: "semestre", sportIds: [], groups: 20, cycle: [[60], []] },
    ];
    w.sports.push({ id: "s2", name: "Hand", priority: false, barrette: false, placeIds: [] });
    setWs(w);
    renderAt(<ClassesPage />, "/classes");
    const u = userEvent.setup();
    expect(screen.queryByText("5e")).toBeNull();
    expect(screen.queryByText("inutilisé")).toBeNull();
    expect(screen.getByText("PRIO")).toBeInTheDocument();
    expect(screen.getByText(/Moins de sports/)).toBeInTheDocument();
    const six = within(document.getElementById("col-l6")!);
    const other = within(document.getElementById("col-lx")!);
    await u.click(six.getByLabelText("Plus"));
    expect(ws().levels[0].groups).toBe(2);
    expect(six.getByLabelText("Moins")).toBeEnabled();
    expect(other.getByLabelText("Plus")).toBeDisabled();
    await u.click(other.getByLabelText("Moins"));
    expect(ws().levels[1].groups).toBe(19);
    await u.click(six.getByText("2 sem."));
    expect(ws().levels[0].cycle).toEqual([[120], [120]]);
    await u.click(six.getByText("Semestre"));
    expect(ws().levels[0].mode).toBe("semestre");
    await u.click(six.getByLabelText("Retirer Foot"));
    expect(ws().levels[0].sportIds).toEqual(["ghost"]);
    await u.click(other.getByText("Ajouter"));
    await u.click(other.getByText("Hand"));
    expect(ws().levels[1].sportIds).toEqual(["s2"]);
    await u.click(other.getByText("Ajouter"));
    await u.keyboard("Tennis{Enter}");
    expect(ws().sports.map((s) => s.name)).toContain("Tennis");
    expect(ws().levels[1].sportIds).toHaveLength(2);
    const name = other.getByDisplayValue("Autre");
    await u.clear(name);
    await u.type(name, "4e{Enter}");
    expect(ws().levels[1].name).toBe("4e");
    await u.click(other.getByLabelText("Supprimer"));
    expect(ws().levels).toHaveLength(1);
  });
});
