import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { SportsPage } from "./Sports";

const ws = () => useStore.getState().ws;

describe("SportsPage", () => {
  it("vide : aller aux classes", async () => {
    renderAt(<SportsPage />, "/sports");
    await userEvent.click(screen.getByText("Aller aux classes"));
    expect(screen.getByTestId("loc")).toHaveTextContent("/classes");
  });
  it("cases, lieux, ajout", async () => {
    const w = readyWs();
    w.sports.push({ id: "s2", name: "Hand", priority: false, barrette: false, placeIds: ["ghost"] });
    w.places.push({ id: "p2", name: "Gym", color: "#6366f1", outdoor: false, capacity: 1, availability: {} });
    setWs(w);
    renderAt(<SportsPage />, "/sports");
    const u = userEvent.setup();
    const foot = within(document.getElementById("col-s1")!);
    const hand = within(document.getElementById("col-s2")!);
    expect(hand.getByText("Aucune classe")).toBeInTheDocument();
    expect(foot.getByText("EXT")).toBeInTheDocument();
    await u.click(foot.getByText("Prioritaire"));
    await u.click(foot.getByText("Barrette"));
    expect(ws().sports[0]).toMatchObject({ priority: false, barrette: true });
    await u.click(foot.getByLabelText("Retirer Stade"));
    expect(ws().sports[0].placeIds).toEqual([]);
    await u.click(hand.getByText("Ajouter"));
    await u.click(hand.getByText("Gym"));
    expect(ws().sports[1].placeIds).toEqual(["ghost", "p2"]);
    await u.click(hand.getByText("Ajouter"));
    await u.keyboard("Piscine{Enter}");
    expect(ws().places.map((p) => p.name)).toContain("Piscine");
    expect(ws().sports[1].placeIds).toHaveLength(3);
    await u.click(screen.getByText("Ajouter un sport"));
    expect(ws().sports[2].name).toBe("Sport 3");
    const input = foot.getByDisplayValue("Foot");
    await u.clear(input);
    await u.type(input, "Futsal{Enter}");
    expect(ws().sports[0].name).toBe("Futsal");
    await u.click(hand.getByLabelText("Supprimer"));
    expect(ws().sports).toHaveLength(2);
  });
});
