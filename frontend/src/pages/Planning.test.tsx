import { api } from "../lib/api";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useStore } from "../store";
import { jsonRes, mockFetch, readyWs, renderAt, setWs } from "../test/utils";
import type { Solution, SolveResult, Workspace } from "../types";
import { PlanningPage } from "./Planning";

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const xlsx = () => new File(["x"], "edt.xlsx");

const solution = (index: number): Solution => ({
  index,
  plan: { l6: { T1: "s1", T2: "ghost" }, l5: { S1: "s1" } },
  assignments: [
    { slotId: "0-0", levelId: "l6", period: "T1", sportId: "s1", placements: [{ placeId: "p1", groups: 2 }] },
    { slotId: "0-0", levelId: "zz", period: "S1", sportId: "zz", placements: [{ placeId: "zz", groups: 1 }] },
    { slotId: "1-0", levelId: "l5", period: "S2", sportId: "s1", placements: [{ placeId: "p1", groups: 1 }] },
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
    const ws: Workspace = { ...readyWs(), levels: [readyWs().levels[0]] };
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
