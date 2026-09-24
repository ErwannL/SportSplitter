import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { usePrefs } from "../prefs";
import { Onboarding } from "./Onboarding";

describe("Onboarding", () => {
  it("fermé par défaut dans les tests", () => {
    render(<Onboarding />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("suivant / précédent / choisir / commencer / fermer", async () => {
    usePrefs.setState({ onboardingOpen: true });
    render(<Onboarding />);
    const u = userEvent.setup();
    expect(screen.getByText("Précédent", { exact: false })).toBeDisabled();
    await u.click(screen.getByRole("button", { name: /Suivant/ }));
    await u.click(screen.getByRole("button", { name: /Précédent/ }));
    await u.click(screen.getByText(/^5\./).closest("button")!);
    await u.click(screen.getByText(/^2\./).closest("button")!);
    await u.click(screen.getByText(/^5\./).closest("button")!);
    await u.click(screen.getByRole("button", { name: /C'est parti|Commencer|start/i }));
    expect(usePrefs.getState().onboardingOpen).toBe(false);
    usePrefs.getState().openOnboarding();
    await screen.findByRole("dialog");
    await u.click(screen.getByLabelText("Fermer"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
