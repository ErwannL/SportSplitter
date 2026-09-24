import { describe, expect, it, vi } from "vitest";
import { jsonRes, mockFetch, readyWs } from "../test/utils";
import { api } from "./api";

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
    const sol = { index: 2, plan: {}, assignments: [], violations: [] };
    await api.exportSolutions(readyWs(), [sol]);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("planning-3.xlsx");
    await api.exportSolutions(readyWs(), [sol, sol], "en");
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toBe("plannings.xlsx");
    expect(revoke).toHaveBeenCalledWith("blob:u");
    mockFetch(async () => jsonRes({}, 500));
    await expect(api.exportSolutions(readyWs(), [sol])).rejects.toThrow("HTTP 500");
  });
});
