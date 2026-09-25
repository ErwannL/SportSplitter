import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { PlacesPage } from "./Places";

const ws = () => useStore.getState().ws;
const place = (id: string) => ws().places.find((p) => p.id === id)!;
const cell = (pid: string, sid: string) => screen.getByTestId(`avail-${pid}-${sid}`).parentElement!;

describe("PlacesPage", () => {
  it("sans emploi du temps", async () => {
    renderAt(<PlacesPage />, "/lieux");
    await userEvent.click(screen.getByText("Importer"));
    expect(screen.getByTestId("loc")).toHaveTextContent(/^\/$/);
  });
  it("sans lieu : ajout du premier", async () => {
    setWs({ ...readyWs(), places: [] });
    renderAt(<PlacesPage />, "/lieux");
    await userEvent.click(screen.getByText("Ajouter un lieu"));
    expect(ws().places[0].name).toBe("Gymnase");
  });
  it("pinceau, couleurs, capacité, remplissage", async () => {
    const w = readyWs();
    w.places.push({ id: "p2", name: "Gym", color: "#10b982", outdoor: false, capacity: 1, availability: {} });
    setWs(w);
    renderAt(<PlacesPage />, "/lieux");
    const u = userEvent.setup();
    expect(screen.getByText(/trop proche de « Gym »/)).toBeInTheDocument();

    // pinceau "Toute l'année" sur une case pleine : retire, et le glisser propage le retrait
    fireEvent.pointerDown(cell("p1", "0-0"));
    fireEvent.pointerEnter(cell("p1", "1-0"));
    fireEvent.pointerEnter(cell("p2", "1-0"));
    expect(place("p1").availability).toEqual({ "0-0": [], "1-0": [] });
    expect(place("p2").availability).toEqual({});
    fireEvent.pointerUp(window);
    fireEvent.pointerEnter(cell("p1", "0-0"));
    expect(place("p1").availability["0-0"]).toEqual([]);

    await u.click(screen.getByRole("radio", { name: "S1" }));
    fireEvent.pointerDown(cell("p2", "0-0"));
    expect(place("p2").availability["0-0"]).toEqual(["Q1", "Q2"]);
    await u.click(screen.getByRole("radio", { name: /Effacer/ }));
    fireEvent.pointerDown(cell("p2", "0-0"));
    expect(place("p2").availability["0-0"]).toEqual([]);
    fireEvent.pointerUp(window);

    const gym = within(document.getElementById("col-p2")!);
    expect(gym.getByLabelText("#10b981")).toBeDisabled();
    await u.click(gym.getByLabelText("#6366f1"));
    expect(place("p2").color).toBe("#6366f1");
    fireEvent.change(gym.getByLabelText("Couleur personnalisée"), { target: { value: "#123456" } });
    expect(place("p2").color).toBe("#123456");
    await u.click(gym.getByLabelText("Couleur automatique"));
    expect(place("p2").color).not.toBe("#123456");

    await u.click(gym.getByLabelText("Moins"));
    expect(place("p2").capacity).toBe(1);
    await u.click(gym.getByLabelText("Plus"));
    expect(place("p2").capacity).toBe(2);
    await u.click(gym.getByText("Extérieur"));
    expect(place("p2").outdoor).toBe(true);
    await u.click(gym.getByText("Tout"));
    expect(place("p2").availability).toEqual({ "0-0": ["Q1", "Q2", "Q3", "Q4"], "1-0": ["Q1", "Q2", "Q3", "Q4"] });
    await u.click(gym.getByText("Vider"));
    expect(place("p2").availability).toEqual({ "0-0": [], "1-0": [] });

    const name = gym.getByDisplayValue("Gym");
    await u.clear(name);
    await u.type(name, "Salle{Enter}");
    expect(place("p2").name).toBe("Salle");
    await u.click(screen.getByText("Ajouter un lieu"));
    expect(ws().places[2].name).toBe("Lieu 3");
    await u.click(gym.getByLabelText("Supprimer"));
    expect(ws().places).toHaveLength(2);
  });
});
