import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { useAuth } from "../auth";
import { usePrefs } from "../prefs";
import { ADMIN_ME, jsonRes, mockFetch, readyWs } from "../test/utils";
import { readToken } from "./Sso";

const TOKEN = "tok.en-SECRET_123";
const ME = { ...ADMIN_ME, name: "Alice" };

let stored: string[];
beforeEach(() => {
  useAuth.setState({ status: "loading", me: null });
  window.history.pushState(null, "", `/sso#sso=${TOKEN}`);
  stored = [];
  const orig = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
    stored.push(k + "=" + v);
    orig.call(this, k, v);
  });
});

/** Vérifie que le jeton n'a jamais été écrit dans le stockage du navigateur. */
function expectTokenNotStored() {
  expect(stored.join("\n")).not.toContain(TOKEN);
  for (const s of [localStorage, sessionStorage])
    for (let i = 0; i < s.length; i++) expect(s.key(i)! + s.getItem(s.key(i)!)).not.toContain(TOKEN);
}

describe("readToken", () => {
  it("lit #sso=", () => {
    expect(readToken("#sso=abc")).toBe("abc");
    expect(readToken("sso=abc&x=1")).toBe("abc");
    expect(readToken("#sso=")).toBeNull();
    expect(readToken("")).toBeNull();
  });
});

describe("SsoPage", () => {
  it("succès : fragment effacé avant l'appel, jeton dans le corps, puis application", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const seen: { url: string; hash: string; path: string; replaced: number }[] = [];
    const f = mockFetch(async (url) => {
      seen.push({ url, hash: window.location.hash, path: window.location.pathname, replaced: replace.mock.calls.length });
      if (url === "/api/auth/sso") return jsonRes({ ok: true });
      if (url === "/api/me") return jsonRes(ME);
      return jsonRes(readyWs());
    });
    render(<App />);
    expect(await screen.findByText(/Retour sur Orqea \(Alice\)/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
    // /api/me n'est pas appelé avant l'échange du jeton
    expect(seen.map((s) => s.url).filter((u) => u !== "/api/health")).toEqual(["/api/auth/sso", "/api/me", "/api/workspace"]);
    expect(seen[0]).toMatchObject({ hash: "", path: "/sso" });
    // le fragment a été effacé par replaceState avant l'appel (le routeur fait aussi son propre replaceState)
    const before = replace.mock.calls.slice(0, seen[0].replaced);
    expect(before.some(([, , u]) => u === "/sso")).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).not.toContain(TOKEN);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ token: TOKEN });
    expect(useAuth.getState().status).toBe("authenticated");
    expectTokenNotStored();
  });

  const cases: [string, RegExp][] = [
    ["SSO_INVALID", /n'est pas valide/],
    ["SSO_EXPIRED", /a expiré/],
    ["SSO_REPLAYED", /déjà été utilisé/],
    ["SSO_DISABLED", /n'est pas configurée/],
    ["SSO_MISSING", /Aucun jeton/],
    ["WHATEVER", /n'est pas valide/],
  ];
  /** Refus SSO : {code} seul ; /api/me : 401 avec l'URL d'Orqea configurée côté serveur. */
  const refuse = (code: string) =>
    mockFetch(async (url) =>
      url === "/api/me" ? jsonRes({ code: "UNAUTHENTICATED", orqeaUrl: "https://orqea.example" }, 401) : jsonRes({ code }, 401),
    );
  const ssoCalls = (f: ReturnType<typeof mockFetch>) => f.mock.calls.filter(([u]) => u === "/api/auth/sso").length;

  it.each(cases)("échec %s : message et retour à Orqea", async (code, msg) => {
    const f = refuse(code);
    render(<App />);
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.getByText("Connexion impossible")).toBeInTheDocument();
    // l'URL d'Orqea configurée (SPORTSPLITTER_ORQEA_URL) est apprise via le 401 de /api/me
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Retour à Orqea/ })).toHaveAttribute("href", "https://orqea.example"),
    );
    expect(ssoCalls(f)).toBe(1);
    expect(window.location.hash).toBe("");
    expect(document.querySelector("nav")).toBeNull();
    expectTokenNotStored();
  });

  it("échec avec une session déjà ouverte : lien par défaut", async () => {
    mockFetch(async (url) => (url === "/api/me" ? jsonRes(ADMIN_ME) : jsonRes({ code: "SSO_REPLAYED" }, 401)));
    render(<App />);
    expect(await screen.findByText(/déjà été utilisé/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Retour à Orqea/ })).toHaveAttribute("href", "https://orqea.dev");
  });

  it("lien de retour par défaut si /api/me ne répond pas", async () => {
    mockFetch(async (url) => (url === "/api/me" ? Promise.reject(new TypeError("down")) : jsonRes({ code: "SSO_EXPIRED" }, 401)));
    render(<App />);
    expect(await screen.findByRole("link", { name: /Retour à Orqea/ })).toHaveAttribute("href", "https://orqea.dev");
  });

  it("jeton absent : SSO_MISSING sans appel réseau", async () => {
    window.history.pushState(null, "", "/sso");
    const f = refuse("x");
    render(<App />);
    expect(await screen.findByText(/Aucun jeton de connexion reçu/)).toBeInTheDocument();
    expect(ssoCalls(f)).toBe(0);
  });

  it("401 non JSON, réseau en panne, erreur HTTP : SSO_INVALID", async () => {
    for (const impl of [
      async () => ({ ok: false, status: 401, json: () => Promise.reject(new Error("html")) }) as Response,
      async () => Promise.reject(new TypeError("Failed to fetch")),
      async () => jsonRes({}, 500),
    ]) {
      window.history.pushState(null, "", `/sso#sso=${TOKEN}`);
      mockFetch(impl);
      const { unmount } = render(<App />);
      expect(await screen.findByText(/n'est pas valide/)).toBeInTheDocument();
      expect(window.location.hash).toBe("");
      unmount();
    }
    expectTokenNotStored();
  });

  it("StrictMode : le jeton n'est échangé qu'une fois", async () => {
    const f = refuse("SSO_EXPIRED");
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(await screen.findByText(/a expiré/)).toBeInTheDocument();
    expect(ssoCalls(f)).toBe(1);
  });

  it("en anglais", async () => {
    usePrefs.getState().setLang("en");
    mockFetch(async () => jsonRes({ code: "SSO_REPLAYED" }, 401));
    render(<App />);
    expect(await screen.findByText(/already been used/)).toBeInTheDocument();
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Orqea/ })).toBeInTheDocument();
  });
});
