import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { useAuth } from "./auth";
import { AuthError } from "./lib/api";
import { usePrefs } from "./prefs";
import { localKey, useStore } from "./store";
import { ADMIN_ME, jsonRes, mockFetch, readyWs } from "./test/utils";

const ME = { ...ADMIN_ME, sub: "u42", name: "Alice" };
const denied = (orqeaUrl = "https://orqea.example/app") => jsonRes({ code: "UNAUTHENTICATED", orqeaUrl }, 401);

/** Aucun élément de l'application dans le DOM. */
function expectNothingOfTheApp() {
  const text = document.body.textContent ?? "";
  expect(document.querySelector("nav")).toBeNull();
  expect(document.querySelector("aside")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  for (const w of ["Planning", "Classes", "Sports", "Lieux", "Foot", "Stade", "Importer", "Administration", "Guide", "6e"]) {
    expect(text).not.toContain(w);
  }
}

beforeEach(() => {
  useAuth.setState({ status: "loading", me: null });
  window.history.pushState(null, "", "/");
});

describe("accès sans session", () => {
  it("/api/me → 401 : écran « Accès via Orqea » et rien de l'application", async () => {
    // espace de travail d'un utilisateur précédent et guide ouvert : ne doivent pas apparaître
    useStore.setState({ ws: readyWs(), loaded: true });
    usePrefs.setState({ onboardingOpen: true, onboarded: false });
    const f = mockFetch(async () => denied());
    render(<App />);
    expect(await screen.findByText("Accès via Orqea")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Aller sur Orqea/ })).toHaveAttribute("href", "https://orqea.example/app");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/api/me");
    expectNothingOfTheApp();
  });
  it("401 sans corps JSON : lien Orqea par défaut", async () => {
    mockFetch(async () => ({ ok: false, status: 401, json: () => Promise.reject(new Error("html")) }) as Response);
    render(<App />);
    expect(await screen.findByRole("link", { name: /Aller sur Orqea/ })).toHaveAttribute("href", "https://orqea.dev");
    expectNothingOfTheApp();
  });
  it("serveur injoignable puis réessai", async () => {
    let up = false;
    mockFetch(async (url) => {
      if (!up) throw new TypeError("Failed to fetch");
      return url === "/api/me" ? jsonRes(ME) : jsonRes(readyWs());
    });
    render(<App />);
    expect(await screen.findByText("Serveur injoignable")).toBeInTheDocument();
    expectNothingOfTheApp();
    up = true;
    await userEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    expect(await screen.findByText(/Se déconnecter \(Alice\)/)).toBeInTheDocument();
    expect(useStore.getState().ws.sports[0].name).toBe("Foot");
  });
  it("écrans en anglais", async () => {
    usePrefs.getState().setLang("en");
    mockFetch(async () => denied());
    const { unmount } = render(<App />);
    expect(await screen.findByText("Access through Orqea")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Orqea/ })).toBeInTheDocument();
    unmount();
    useAuth.setState({ status: "loading" });
    mockFetch(async () => Promise.reject(new Error("down")));
    render(<App />);
    expect(await screen.findByText("Server unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });
});

describe("session expirée en cours d'usage", () => {
  it("la modification est gardée localement, puis renvoyée après reconnexion", async () => {
    let session = true;
    const puts: string[] = [];
    mockFetch(async (url, init) => {
      if (url === "/api/me") return session ? jsonRes(ME) : denied();
      if (init?.method === "PUT") {
        if (!session) return denied();
        puts.push(init.body as string);
        return jsonRes({});
      }
      return session ? jsonRes(readyWs()) : denied();
    });
    render(<App />);
    expect(await screen.findByText(/Se déconnecter \(Alice\)/)).toBeInTheDocument();
    session = false;
    act(() => void useStore.getState().addSport("Tennis"));
    await act(() => useStore.getState().flush());
    expect(await screen.findByText("Accès via Orqea")).toBeInTheDocument();
    expectNothingOfTheApp();
    const saved = JSON.parse(localStorage.getItem(localKey("u42"))!);
    expect(saved.dirty).toBe(true);
    expect(saved.ws.sports.map((s: { name: string }) => s.name)).toEqual(["Foot", "Tennis"]);
    expect(useStore.getState()).toMatchObject({ sub: "", loaded: false });
    expect(usePrefs.getState().me.permissions).toEqual([]);
    // reconnexion
    session = true;
    await act(() => useAuth.getState().check());
    expect(await screen.findByText(/Se déconnecter \(Alice\)/)).toBeInTheDocument();
    expect(useStore.getState().ws.sports.map((s) => s.name)).toEqual(["Foot", "Tennis"]);
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]).sports).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(localKey("u42"))!).dirty).toBe(false);
  });
  it("expire ignoré si pas connecté", () => {
    useAuth.setState({ status: "anonymous", orqeaUrl: "https://a" });
    useAuth.getState().expire(new AuthError("X", "https://b"));
    expect(useAuth.getState().orqeaUrl).toBe("https://a");
  });
});

describe("déconnexion", () => {
  async function loggedIn() {
    const f = mockFetch(async (url) => (url === "/api/me" ? jsonRes(ME) : jsonRes(readyWs())));
    render(<App />);
    return { f, button: await screen.findByRole("button", { name: /Se déconnecter \(Alice\)/ }) };
  }
  it("succès : modifications envoyées, session fermée", async () => {
    const { f, button } = await loggedIn();
    act(() => void useStore.getState().addSport("Tennis"));
    await userEvent.click(button);
    expect(await screen.findByText("Accès via Orqea")).toBeInTheDocument();
    const urls = f.mock.calls.map(([u, i]) => `${i?.method ?? "GET"} ${u}`);
    expect(urls.slice(-2)).toEqual(["PUT /api/workspace", "POST /api/auth/logout"]);
    expect(useStore.getState().sub).toBe("");
    expect(useAuth.getState().me).toBeNull();
    expectNothingOfTheApp();
  });
  it("échec réseau : déconnecté quand même, sans erreur non gérée", async () => {
    await loggedIn();
    mockFetch(async () => Promise.reject(new Error("down")));
    await act(() => expect(useAuth.getState().logout()).resolves.toBeUndefined());
    expect(await screen.findByText("Accès via Orqea")).toBeInTheDocument();
    expect(useAuth.getState().status).toBe("anonymous");
    expect(useStore.getState().sub).toBe("");
  });
  it("libellé sans nom et en anglais", async () => {
    useStore.setState({ ws: readyWs() });
    usePrefs.setState({ me: { ...ADMIN_ME, name: "" } });
    usePrefs.getState().setLang("en");
    useAuth.setState({ status: "authenticated" });
    mockFetch(async () => jsonRes({}));
    const { AuthGate } = await import("./App");
    const { MemoryRouter } = await import("react-router-dom");
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>,
    );
    const aside = document.querySelector("aside")!;
    expect(within(aside as HTMLElement).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
