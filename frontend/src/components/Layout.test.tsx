import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { usePrefs } from "../prefs";
import { useStore } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { Layout } from "./Layout";

describe("Layout", () => {
  it("menu, thème, langue, aide, repli", async () => {
    setWs(readyWs());
    renderAt(<Layout />, "/classes");
    const u = userEvent.setup();
    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Sauvegarde automatique")).toBeInTheDocument();
    await u.click(screen.getByLabelText("Thème sombre"));
    expect(usePrefs.getState().theme).toBe("dark");
    await u.click(screen.getByLabelText("Thème clair"));
    await u.click(screen.getByRole("button", { name: "en" }));
    expect(usePrefs.getState().lang).toBe("en");
    await u.click(screen.getByRole("button", { name: "fr" }));
    await u.click(screen.getByLabelText("Guide de démarrage"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await u.click(screen.getByLabelText("Fermer"));
    await u.click(screen.getByLabelText("Réduire le menu"));
    expect(usePrefs.getState().collapsed).toBe(true);
    expect(screen.queryByText("Sauvegarde automatique")).toBeNull();
    await u.click(screen.getByLabelText("Déployer le menu"));
  });
  it("états de sauvegarde, sans admin, page admin sans guide", () => {
    usePrefs.setState({ me: { role: "prof", permissions: [] }, collapsed: true });
    useStore.setState({ save: "saving" });
    const { unmount } = renderAt(<Layout />, "/admin");
    expect(screen.queryByTitle("Administration")).toBeNull();
    expect(screen.queryByText(/Étape suivante/)).toBeNull();
    unmount();
    usePrefs.setState({ collapsed: false });
    useStore.setState({ save: "offline" });
    renderAt(<Layout />, "/");
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
  });
  it("sauvegarde en cours affichée", () => {
    useStore.setState({ save: "saving" });
    renderAt(<Layout />, "/");
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();
  });
});
