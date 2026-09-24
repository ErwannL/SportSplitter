import type { Solution, SolveResult, Timetable, Workspace } from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
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

export const api = {
  loadWorkspace: () => fetch("/api/workspace").then((r) => json<Workspace>(r)),

  saveWorkspace: (ws: Workspace) =>
    fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ws),
    }).then((r) => json<Workspace>(r)),

  parseTimetable: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/timetable/parse", { method: "POST", body: form }).then((r) => json<Timetable>(r));
  },

  solve: (ws: Workspace) =>
    fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ws),
    }).then((r) => json<SolveResult>(r)),

  async exportSolutions(ws: Workspace, solutions: Solution[]) {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: ws, solutions }),
    });
    if (!res.ok) throw new Error("Export impossible");
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
