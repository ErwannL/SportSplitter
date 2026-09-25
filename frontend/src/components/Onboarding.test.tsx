import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { usePrefs } from "../prefs";
import { Onboarding } from "./Onboarding";
import { FRAME_MS, SCENES } from "./TourDemo";

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

describe("Onboarding animé", () => {
  it("enchaîne les scènes automatiquement et peut rejouer", async () => {
    vi.useFakeTimers();
    usePrefs.setState({ onboardingOpen: true });
    render(<Onboarding />);
    const current = () => screen.getByRole("button", { current: "step" }).textContent;
    expect(current()).toContain("1.");
    for (let k = 0; k < SCENES[0].length; k++) act(() => void vi.advanceTimersByTime(FRAME_MS));
    expect(current()).toContain("2.");
    for (let k = 0; k < 200; k++) act(() => void vi.advanceTimersByTime(FRAME_MS));
    expect(current()).toContain("5.");
    fireEvent.click(screen.getByText("Revoir l'animation"));
    expect(screen.getByTestId("tour-demo").dataset.frame).toBe("0");
    vi.useRealTimers();
  });
});
