import type { Lang } from "./i18n";
import type { Me, Solution, SolveResult, Timetable, Workspace } from "../types";

export const DEFAULT_ORQEA_URL = "https://orqea.dev";

/** 401 : pas (ou plus) de session. `orqeaUrl` vient du serveur (SPORTSPLITTER_ORQEA_URL). */
export class AuthError extends Error {
  constructor(
    public code: string,
    public orqeaUrl: string = DEFAULT_ORQEA_URL,
  ) {
    super(code);
  }
}

type Handler = (err: AuthError) => void;
let onUnauthorized: Handler | null = null;

/** Appelé quand une requête reçoit 401 en cours d'usage (session expirée). */
export function setUnauthorizedHandler(fn: Handler | null) {
  onUnauthorized = fn;
}

/** Toutes les requêtes : cookie de session (même origine) + en-tête anti-CSRF. */
async function request(path: string, init: RequestInit = {}, { silent401 = false } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "sportsplitter");
  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (res.status === 401) {
    let body: { code?: string; orqeaUrl?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* corps non JSON */
    }
    const err = new AuthError(body.code ?? "UNAUTHENTICATED", body.orqeaUrl ?? DEFAULT_ORQEA_URL);
    if (!silent401) onUnauthorized?.(err);
    throw err;
  }
  return res;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* corps non JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  /** Public : l'URL d'Orqea de CET environnement (localhost en dev, orqea.dev en prod). */
  async orqeaUrl(): Promise<string | null> {
    try {
      const res = await fetch("/api/health");
      const body = (await res.json()) as { orqeaUrl?: string };
      return body.orqeaUrl ?? null;
    } catch {
      return null;
    }
  },

  /** Session courante ; AuthError si aucune (sans déclencher le gestionnaire global). */
  me: () => request("/api/me", {}, { silent401: true }).then((r) => json<Me>(r)),

  /** Échange le jeton de passation Orqea contre une session (cookie httpOnly). */
  async sso(token: string) {
    const res = await request("/api/auth/sso", jsonBody("POST", { token }), { silent401: true });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  async logout() {
    await request("/api/auth/logout", { method: "POST" }, { silent401: true });
  },

  loadWorkspace: () => request("/api/workspace").then((r) => json<Workspace>(r)),

  saveWorkspace: (ws: Workspace) =>
    request("/api/workspace", { ...jsonBody("PUT", ws), keepalive: true }).then((r) => json<Workspace>(r)),

  parseTimetable: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request("/api/timetable/parse", { method: "POST", body: form }).then((r) => json<Timetable>(r));
  },

  solve: (ws: Workspace) => request("/api/solve", jsonBody("POST", ws)).then((r) => json<SolveResult>(r)),

  async exportSolutions(ws: Workspace, solutions: Solution[], lang: Lang = "fr") {
    const res = await request("/api/export", jsonBody("POST", { workspace: ws, solutions, lang }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    download(await res.blob(), solutions.length === 1 ? `planning-${solutions[0].index + 1}.xlsx` : "plannings.xlsx");
  },

  templateUrl: "/api/timetable/template",
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
