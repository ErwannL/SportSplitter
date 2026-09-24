import { api } from "../lib/api";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useStore } from "../store";
import { jsonRes, mockFetch, readyWs, renderAt, setWs } from "../test/utils";
import type { Solution, SolveResult, Workspace } from "../types";
import { PlanningPage, slotContents } from "./Planning";

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const xlsx = () => new File(["x"], "edt.xlsx");

const A = { session: 0, week: 0, day: 0, row: 0, span: 1, minutes: 120 };
const solution = (index: number, weeks = 1): Solution => ({
  index,
  plan: { l6: { T1: "s1", T2: "ghost" }, l5: { S1: "s1" } },
  weeks,
  assignments: [
    { ...A, slotId: "0-0", levelId: "l6", period: "T1", sportId: "s1", placements: [{ placeId: "p1", groups: 2 }], span: 2 },
    { ...A, slotId: "0-0", levelId: "zz", period: "S1", sportId: "zz", placements: [{ placeId: "zz", groups: 1 }] },
    { ...A, slotId: "1-0", levelId: "l5", period: "S1", sportId: "ghost", placements: [{ placeId: "zz", groups: 1 }], day: 1 },
    { ...A, slotId: "1-0", levelId: "l5", period: "S1", sportId: "s1", placements: [{ placeId: "p1", groups: 1 }], day: 1, week: 1, minutes: 60 },
  ],
  violations: index === 0 ? [{ rule: "winter_outdoor", message: "m", params: { level: "6e", place: "Stade", period: "T2" } }] : [],
});

const result = (over: Partial<SolveResult> = {}): SolveResult => ({
  status: "ok",
  solutions: [solution(0), solution(1), solution(2)],
  totalFound: 3,
  truncated: false,
  issues: [],
  ...over,
});

describe("PlanningPage : import", () => {
  it("glisser-déposer, choix de fichier, erreur puis succès", async () => {
    let fail = true;
    mockFetch(async () => (fail ? jsonRes({ detail: "Fichier invalide" }, 400) : jsonRes(readyWs().timetable)));
    renderAt(<PlanningPage />);
    const zone = screen.getByText(/glissez-déposez/).parentElement!;
    fireEvent.dragOver(zone);
    expect(zone).toHaveClass("border-indigo-400");
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass("border-indigo-400");
    fireEvent.drop(zone, { dataTransfer: { files: [xlsx()] } });
    expect(await screen.findByText("Fichier invalide")).toBeInTheDocument();
    fireEvent.change(fileInput(), { target: { files: [] } });
    const click = vi.spyOn(fileInput(), "click");
    await userEvent.click(screen.getByText("Importer un fichier"));
    expect(click).toHaveBeenCalled();
    fail = false;
    await userEvent.upload(fileInput(), xlsx());
    expect(await screen.findByText("edt.xlsx")).toBeInTheDocument();
    expect(useStore.getState().ws.timetable?.fileName).toBe("edt.xlsx");
  });
});

describe("PlanningPage : configuration", () => {
  it("incomplet : problèmes cliquables, remplacer en erreur, retirer", async () => {
    const ws: Workspace = readyWs();
    ws.levels[1].cycle = [[]];
    ws.timetable = { ...ws.timetable!, fileName: "" };
    setWs(ws);
    mockFetch(async () => jsonRes({ detail: "Mauvais" }, 400));
    renderAt(<PlanningPage />);
    const u = userEvent.setup();
    expect(screen.getByText("emploi du temps")).toBeInTheDocument();
    expect(screen.getByTitle("Configuration incomplète")).toBeDisabled();
    await u.upload(fileInput(), xlsx());
    expect(await screen.findByText("Mauvais")).toBeInTheDocument();
    await u.click(screen.getByText(/niveau « 5e »/));
    expect(screen.getByTestId("loc")).toHaveTextContent("/classes");
  });
  it("clic sur une case : fermer puis rouvrir", () => {
    setWs(readyWs());
    renderAt(<PlanningPage />);
    const closed = () => useStore.getState().ws.timetable!.cells.map((c) => c.closed);
    expect(closed()).toEqual([false, false, true]);
    expect(screen.getAllByText("Fermé")).toHaveLength(1);
    fireEvent.pointerDown(screen.getByText("Fermé").parentElement!);
    expect(closed()).toEqual([false, false, false]);
    expect(screen.queryByText("Fermé")).toBeNull();
    const first = document.querySelector<HTMLElement>(".cursor-pointer")!;
    fireEvent.pointerDown(first);
    expect(closed()).toEqual([true, false, false]);
    expect(screen.getAllByText("Fermé")).toHaveLength(1);
  });
  it("retirer l'emploi du temps et remplacer", async () => {
    setWs(readyWs());
    renderAt(<PlanningPage />);
    const click = vi.spyOn(fileInput(), "click");
    await userEvent.click(screen.getByText("Remplacer"));
    expect(click).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Retirer l'emploi du temps"));
    expect(useStore.getState().ws.timetable).toBeNull();
  });
  it("génération : erreur réseau", async () => {
    setWs(readyWs());
    renderAt(<PlanningPage />);
    await userEvent.click(screen.getByText("Générer les plannings"));
    expect(await screen.findByText("offline")).toBeInTheDocument();
  });
  it("?run=1 relance la génération automatiquement (si prêt) puis retire le paramètre", async () => {
    setWs(readyWs());
    const f = mockFetch(() => Promise.resolve(jsonRes({ status: "infeasible", solutions: [], totalFound: 0, truncated: false, issues: [] })));
    renderAt(<PlanningPage />, "/?run=1");
    await waitFor(() => expect(f).toHaveBeenCalledWith("/api/solve", expect.anything()));
    expect(screen.getByTestId("loc").textContent).toBe("/");
    expect(f.mock.calls.filter(([u]) => u === "/api/solve")).toHaveLength(1);
  });
  it("?run=1 sans configuration complète : ne lance rien", async () => {
    const ws = readyWs();
    ws.levels = [];
    setWs(ws);
    const f = mockFetch(() => Promise.resolve(jsonRes({})));
    renderAt(<PlanningPage />, "/?run=1");
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/"));
    expect(f.mock.calls.some(([u]) => u === "/api/solve")).toBe(false);
  });
  it("génération : impossible avec problèmes triés et cliquables", async () => {
    setWs(readyWs());
    let resolve!: (r: Response) => void;
    mockFetch(() => new Promise((r) => (resolve = r)));
    renderAt(<PlanningPage />);
    await userEvent.click(screen.getByText("Générer les plannings"));
    expect(screen.getByText("Recherche des combinaisons…")).toBeInTheDocument();
    await act(async () =>
      resolve(
        jsonRes(
          result({
            status: "infeasible",
            solutions: [],
            issues: [
              { severity: "warning", code: "x", message: "Avertissement serveur", target: "p1", targetType: "place" },
              { severity: "error", code: "no_solution", message: "m", params: {} },
              { severity: "warning", code: "y", message: "Autre avertissement" },
              { severity: "error", code: "level_blocked", message: "m", params: { level: "6e", count: 1 }, target: "l6", targetType: "level" },
            ],
          }),
        ),
      ),
    );
    const items = screen.getByText("Aucun planning possible").parentElement!.querySelectorAll("li");
    expect(items[0]).toHaveTextContent("Aucune combinaison");
    expect(items[3]).toHaveTextContent("Autre avertissement");
    await userEvent.click(screen.getByText("Avertissement serveur"));
    expect(screen.getByTestId("loc")).toHaveTextContent("/lieux?focus=p1");
  });
});

describe("PlanningPage : résultats", () => {
  it("parcours, segments, compromis et téléchargements", async () => {
    setWs(readyWs());
    mockFetch(async (url) => (url === "/api/solve" ? jsonRes(result({ status: "relaxed", truncated: true })) : jsonRes({})));
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:u"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderAt(<PlanningPage />);
    const u = userEvent.setup();
    await u.click(screen.getByText("Générer les plannings"));
    expect(await screen.findByText("Plannings générés")).toBeInTheDocument();
    expect(screen.getByText(/3\+ combinaison/)).toBeInTheDocument();
    expect(screen.getByText(/utilise un lieu extérieur|outdoor place/)).toBeInTheDocument();
    expect(screen.getAllByText("?").length).toBeGreaterThan(0);
    const counter = () => screen.getByText("Solution", { exact: false, selector: "span" }).textContent;
    await u.click(screen.getByLabelText("Précédente"));
    expect(counter()).toContain("3");
    await u.click(screen.getByLabelText("Suivante"));
    expect(counter()).toContain("1");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await u.click(screen.getByLabelText("Une autre au hasard"));
    expect(counter()).toContain("2");
    await u.click(screen.getByText("Déc – Janv"));
    await u.click(screen.getByText("Févr – Mars"));

    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("La meilleure"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("planning-1.xlsx");
    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("Celle affichée"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect((click.mock.contexts[1] as HTMLAnchorElement).download).toBe("planning-2.xlsx");
    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("Toutes"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));
    expect((click.mock.contexts[2] as HTMLAnchorElement).download).toBe("plannings.xlsx");
    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("Télécharger"));
    expect(screen.queryByText("Toutes")).toBeNull();
    const failing = vi.spyOn(api, "exportSolutions").mockRejectedValueOnce(new Error("boom"));
    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("Toutes"));
    expect(await screen.findByText("Export impossible")).toBeInTheDocument();
    failing.mockRestore();
    await u.click(screen.getByText("Télécharger"));
    await u.click(screen.getByText("La meilleure"));
    await waitFor(() => expect(screen.queryByText("Export impossible")).toBeNull());

    await u.click(screen.getByText("Retour à la configuration"));
    expect(useStore.getState().result).toBeNull();
    expect(screen.getByText("Générer les plannings")).toBeInTheDocument();
  });
  it("résultat ok sans place extérieure hors hiver", () => {
    const ws = readyWs();
    ws.places[0].outdoor = false;
    setWs(ws);
    useStore.setState({ result: result() });
    renderAt(<PlanningPage />);
    expect(screen.queryByText(/meilleurs compromis/)).toBeNull();
    expect(screen.queryByText("extérieur")).toBeNull();
  });
});

describe("PlanningPage : problèmes gardés", () => {
  it("affiche les problèmes du dernier calcul marqués périmés", () => {
    setWs(readyWs());
    useStore.setState({
      lastIssues: { stale: true, issues: [{ severity: "error", code: "no_solution", message: "m", targetType: "place" }] },
    });
    renderAt(<PlanningPage />);
    expect(screen.getByText("Aucun planning possible")).toBeInTheDocument();
    expect(screen.getByText("Dernier calcul fait avant vos modifications")).toBeInTheDocument();
  });
});

describe("slotContents", () => {
  it("lignes couvertes, première vs suite, semaines du cycle, inconnus", () => {
    const ws = readyWs();
    const sol = solution(0, 2);
    const w0 = slotContents(ws, sol, "Q1", 0);
    expect(w0.get("0-0")).toEqual([
      { level: "6e", sport: "Foot", place: "Stade", color: "#10b981", groups: 2, outdoor: true, first: true, time: "8h – " },
    ]);
    expect(w0.get("0-1")![0]).toMatchObject({ level: "6e", first: false, time: "8h – " });
    expect(w0.get("1-0")).toEqual([
      { level: "5e", sport: "?", place: "?", color: "#94a3b8", groups: 1, outdoor: false, first: true, time: "8h – 10h" },
    ]);
    expect(w0.get("1-0")).toHaveLength(1);
    const w1 = slotContents(ws, sol, "Q1", 1);
    expect(w1.get("0-0")![0].level).toBe("6e");
    expect(w1.get("1-0")).toEqual([expect.objectContaining({ level: "5e", sport: "Foot", time: "8h – 10h" })]);
    expect(slotContents(ws, sol, "Q4", 0).size).toBe(0);
    const out = { ...sol, assignments: [{ ...sol.assignments[0], row: 7, span: 1 }] };
    expect(slotContents(ws, out, "Q1", 0).get("0-7")![0].time).toBe(" – ");
  });
});

describe("PlanningPage : semaines et séances longues", () => {
  it("sélecteur de semaine et affichage sur plusieurs lignes", async () => {
    setWs(readyWs());
    useStore.setState({ result: result({ solutions: [solution(0, 2)] }) });
    renderAt(<PlanningPage />);
    const u = userEvent.setup();
    const w1 = screen.getByText("Semaine 1");
    const w2 = screen.getByText("Semaine 2");
    expect(w1).toHaveAttribute("aria-pressed", "true");
    const sixes = screen.getAllByTitle("6e · Foot · Stade · 8h –", { normalizer: (x) => x.trim() });
    expect(sixes).toHaveLength(2);
    expect(sixes[0]).not.toHaveClass("opacity-80");
    expect(sixes[1]).toHaveClass("opacity-80");
    expect(screen.queryByTitle(/5e · Foot/)).toBeNull();
    await u.click(w2);
    expect(w2).toHaveAttribute("aria-pressed", "true");
    expect(w1).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTitle("5e · Foot · Stade · 8h – 10h")).toBeInTheDocument();
    expect(screen.queryByTitle(/5e · \?/)).toBeNull();
    const five = () => screen.getByTitle("5e · Foot · Stade · 8h – 10h");
    expect(five().querySelector(".lucide-snowflake")).toBeNull();
    await u.click(screen.getByText("Déc – Janv"));
    expect(five().querySelector(".lucide-snowflake")).not.toBeNull();
  });
  it("pas de sélecteur pour un cycle d'une semaine", () => {
    setWs(readyWs());
    useStore.setState({ result: result() });
    renderAt(<PlanningPage />);
    expect(screen.queryByText("Semaine 1")).toBeNull();
  });
});
