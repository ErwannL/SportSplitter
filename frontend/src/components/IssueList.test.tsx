import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { readyWs, renderAt } from "../test/utils";
import type { Issue, SolveResult } from "../types";
import { IssueBadge, TabIssues } from "./IssueList";

const infeasible = (issues: Issue[]): SolveResult => ({ status: "infeasible", solutions: [], totalFound: 0, truncated: false, issues });

describe("TabIssues", () => {
  it("n'affiche rien sans problème", () => {
    useStore.setState({ ws: readyWs() });
    renderAt(<TabIssues types={["sport"]} />);
    expect(screen.queryByText("Problèmes à corriger sur cette page")).toBeNull();
  });

  it("montre problèmes de configuration et du dernier calcul, triés, avec solution, et les garde après modification", async () => {
    const ws = readyWs();
    ws.sports[0].placeIds = [];
    const sid = ws.sports[0].id;
    useStore.setState({ ws });
    useStore.getState().setResult(
      infeasible([
        { severity: "error", code: "sport_no_place", message: "m0", target: sid, targetType: "sport", params: { sport: "S" } },
        { severity: "warning", code: "sport_period_unavailable", message: "m00", target: sid, targetType: "sport", params: { sport: "S", level: "L", period: "T1" } },
        { severity: "warning", code: "barrette_single", message: "m1", target: sid, targetType: "sport", params: { sport: "S", level: "L", min: 2 } },
        { severity: "error", code: "priority_impossible", message: "m2", target: sid, targetType: "sport", params: { sport: "S", level: "L" } },
        { severity: "error", code: "level_blocked", message: "m3", target: "x", targetType: "level", params: { level: "L", count: 1 } },
        { severity: "error", code: "no_solution", message: "m4" },
        { severity: "error", code: "sport_no_place", message: "m5", target: sid, targetType: "sport", params: { sport: "S" } },
      ]),
    );
    renderAt(<TabIssues types={["sport"]} />);
    expect(screen.getByText("Problèmes à corriger sur cette page")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("n'a aucun lieu");
    expect(items.at(-1)).toContain("barrette");
    expect(screen.getAllByText("Solution :").length).toBeGreaterThan(0);
    expect(screen.queryByText(/L » : 1 période/)).toBeNull();
    expect(screen.queryByText("Dernier calcul fait avant vos modifications")).toBeNull();

    useStore.getState().updateSport(sid, { priority: true });
    expect(await screen.findByText("Dernier calcul fait avant vos modifications")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Relancer la génération"));
    expect(screen.getByTestId("loc").textContent).toBe("/");
  });

  it("un calcul réussi efface les problèmes, remettre le résultat à null les garde", () => {
    useStore.getState().setResult(infeasible([{ severity: "error", code: "no_solution", message: "m" }]));
    useStore.getState().setResult(null);
    expect(useStore.getState().lastIssues?.issues).toHaveLength(1);
    useStore.getState().setResult({ status: "ok", solutions: [], totalFound: 0, truncated: false, issues: [] });
    expect(useStore.getState().lastIssues).toBeNull();
  });
});

describe("IssueBadge", () => {
  it("compte les erreurs visant l'élément", () => {
    useStore.getState().setResult(
      infeasible([
        { severity: "error", code: "a", message: "", target: "p1" },
        { severity: "warning", code: "b", message: "", target: "p1" },
      ]),
    );
    renderAt(<><IssueBadge id="p1" /><IssueBadge id="p2" /></>);
    expect(screen.getByTitle("1 problème(s) lors du dernier calcul")).toHaveTextContent("1");
  });
});
