import { describe, expect, it, vi } from "vitest";
import { jsonRes, mockFetch, readyWs } from "../test/utils";
import { api, AuthError, DEFAULT_ORQEA_URL, setUnauthorizedHandler } from "./api";

describe("api", () => {
  it("succès JSON", async () => {
    const f = mockFetch(async () => jsonRes({ role: "r", permissions: [] }));
    await expect(api.me()).resolves.toEqual({ role: "r", permissions: [] });
    await api.loadWorkspace();
    await api.saveWorkspace(readyWs());
    await api.solve(readyWs());
    await api.parseTimetable(new File(["a"], "a.xlsx"));
    expect(f).toHaveBeenCalledTimes(5);
    expect(api.templateUrl).toBe("/api/timetable/template");
  });
  it("erreurs : detail texte, detail non texte, corps non JSON", async () => {
    mockFetch(async () => jsonRes({ detail: "boom" }, 400));
    await expect(api.me()).rejects.toThrow("boom");
    mockFetch(async () => jsonRes({ detail: [1] }, 422));
    await expect(api.me()).rejects.toThrow("HTTP 422");
    mockFetch(async () => ({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }) as Response);
    await expect(api.me()).rejects.toThrow("HTTP 500");
  });
  it("export : téléchargement et échec", async () => {
    const create = vi.fn(() => "blob:u");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockFetch(async () => jsonRes({}));
    const sol = { index: 2, plan: {}, weeks: 1, assignments: [], violations: [] };
    await api.exportSolutions(readyWs(), [sol]);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("planning-3.xlsx");
    await api.exportSolutions(readyWs(), [sol, sol], "en");
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toBe("plannings.xlsx");
    expect(revoke).toHaveBeenCalledWith("blob:u");
    mockFetch(async () => jsonRes({}, 500));
    await expect(api.exportSolutions(readyWs(), [sol])).rejects.toThrow("HTTP 500");
  });
  it("cookie de session et en-tête anti-CSRF sur chaque appel", async () => {
    const f = mockFetch(async () => jsonRes({}));
    await api.me();
    await api.sso("tok");
    await api.logout();
    await api.loadWorkspace();
    await api.saveWorkspace(readyWs());
    await api.solve(readyWs());
    await api.parseTimetable(new File(["a"], "a.xlsx"));
    Object.assign(URL, { createObjectURL: () => "blob:u", revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await api.exportSolutions(readyWs(), [] as never);
    expect(f).toHaveBeenCalledTimes(8);
    for (const [, init] of f.mock.calls) {
      expect(init?.credentials).toBe("same-origin");
      expect(new Headers(init?.headers).get("X-Requested-With")).toBe("sportsplitter");
    }
    const sso = f.mock.calls[1];
    expect(sso[0]).toBe("/api/auth/sso");
    expect(sso[1]?.method).toBe("POST");
    expect(JSON.parse(sso[1]?.body as string)).toEqual({ token: "tok" });
    expect(new Headers(sso[1]?.headers).get("Content-Type")).toBe("application/json");
    expect(f.mock.calls[2][0]).toBe("/api/auth/logout");
  });
  it("sso : erreur HTTP non 401", async () => {
    mockFetch(async () => jsonRes({}, 500));
    await expect(api.sso("t")).rejects.toThrow("HTTP 500");
  });
  it("401 : AuthError, gestionnaire sauf appels silencieux", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    try {
      mockFetch(async () => jsonRes({ code: "SESSION_EXPIRED", orqeaUrl: "https://o.example" }, 401));
      const err = await api.loadWorkspace().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(err).toMatchObject({ code: "SESSION_EXPIRED", orqeaUrl: "https://o.example", message: "SESSION_EXPIRED" });
      expect(handler).toHaveBeenCalledWith(err);
      await expect(api.saveWorkspace(readyWs())).rejects.toBeInstanceOf(AuthError);
      await expect(api.solve(readyWs())).rejects.toBeInstanceOf(AuthError);
      expect(handler).toHaveBeenCalledTimes(3);
      await expect(api.me()).rejects.toBeInstanceOf(AuthError);
      await expect(api.sso("t")).rejects.toBeInstanceOf(AuthError);
      await expect(api.logout()).rejects.toBeInstanceOf(AuthError);
      expect(handler).toHaveBeenCalledTimes(3);
      // corps non JSON : valeurs par défaut
      mockFetch(async () => ({ ok: false, status: 401, json: () => Promise.reject(new Error("x")) }) as Response);
      await expect(api.loadWorkspace()).rejects.toMatchObject({ code: "UNAUTHENTICATED", orqeaUrl: DEFAULT_ORQEA_URL });
      setUnauthorizedHandler(null);
      await expect(api.loadWorkspace()).rejects.toBeInstanceOf(AuthError);
      expect(handler).toHaveBeenCalledTimes(4);
    } finally {
      setUnauthorizedHandler(null);
    }
  });
  it("AuthError : valeurs par défaut", () => {
    const e = new AuthError("X");
    expect(e.orqeaUrl).toBe("https://orqea.dev");
    expect(e).toBeInstanceOf(Error);
  });
});
