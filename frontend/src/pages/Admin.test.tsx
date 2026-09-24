import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { usePrefs } from "../prefs";
import { useStore } from "../store";
import { renderAt } from "../test/utils";
import { AdminPage } from "./Admin";

const settings = () => useStore.getState().ws.settings;

describe("AdminPage", () => {
  it("modifie toutes les règles", async () => {
    renderAt(<AdminPage />, "/admin");
    const u = userEvent.setup();
    expect(screen.queryByText(/pas les droits/)).toBeNull();
    const [maxWinter, barrette, maxSol, time] = screen.getAllByRole("spinbutton");
    fireEvent.change(maxWinter, { target: { value: "3" } });
    fireEvent.change(maxWinter, { target: { value: "99" } });
    fireEvent.change(maxWinter, { target: { value: "-1" } });
    fireEvent.change(barrette, { target: { value: "4" } });
    fireEvent.change(maxSol, { target: { value: "10" } });
    fireEvent.change(time, { target: { value: "30" } });
    expect(settings()).toMatchObject({ maxWinterViolations: 3, barretteMinGroups: 4, maxSolutions: 10, timeLimit: 30 });
    await u.click(screen.getByText("Sept – Nov"));
    expect(settings().winterSegments).toEqual(["Q1", "Q2", "Q3"]);
    await u.click(screen.getByText("Déc – Janv"));
    expect(settings().winterSegments).toEqual(["Q1", "Q3"]);
    await u.click(screen.getByLabelText("Les sports prioritaires sont obligatoires"));
    await u.click(screen.getByLabelText(/Répéter un sport/));
    expect(settings()).toMatchObject({ priorityRequired: false, allowRepeat: false });
    await u.click(screen.getByText("Interdits"));
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(3);
    await u.click(screen.getByLabelText("Plusieurs séances d'un niveau le même jour"));
    expect(settings().sameDayAllowed).toBe(true);
    expect(screen.queryByText("Nombre maximal de lieux partagés tolérés")).toBeNull();
    await u.click(screen.getByText("Lieux différents souhaités"));
    expect(settings().separatePlacesRule).toBe("soft");
    const spins = screen.getAllByRole("spinbutton");
    expect(spins).toHaveLength(4);
    fireEvent.change(spins[0], { target: { value: "5" } });
    expect(settings().maxSeparateViolations).toBe(5);
    await u.click(screen.getByText("Libre"));
    expect(settings().separatePlacesRule).toBe("off");
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(3);
    await u.click(screen.getByText("Lieux différents obligatoires"));
    expect(settings().separatePlacesRule).toBe("hard");
    await u.click(screen.getByText(/Rétablir/));
    expect(settings()).toMatchObject({ sameDayAllowed: false, separatePlacesRule: "hard", maxSeparateViolations: 1 });
    expect(settings().winterRule).toBe("soft");
  });
  it("lecture seule", async () => {
    usePrefs.setState({ me: { role: "prof", permissions: [] } });
    renderAt(<AdminPage />, "/admin");
    expect(screen.getByText(/pas les droits/)).toBeInTheDocument();
    expect(screen.getByText(/Rétablir/).closest("button")).toBeDisabled();
    await userEvent.click(screen.getByText("Ignorés"));
    expect(settings().winterRule).toBe("soft");
  });
});
