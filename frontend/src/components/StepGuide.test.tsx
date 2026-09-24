import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { readyWs, renderAt, setWs } from "../test/utils";
import { StepGuide } from "./StepGuide";

const next = () => screen.queryByText(/Étape suivante/);

describe("StepGuide", () => {
  it("rien de fait : propose l'étape 1 depuis une autre page", () => {
    renderAt(<StepGuide />, "/sports");
    expect(next()).toHaveTextContent("Planning");
  });
  it("sur la page à faire : pas de bouton suivant", () => {
    renderAt(<StepGuide />, "/");
    expect(next()).toBeNull();
  });
  it("page courante faite : étape suivante non faite", () => {
    const ws = readyWs();
    ws.places[0].availability = {};
    setWs(ws);
    renderAt(<StepGuide />, "/classes");
    expect(next()).toHaveTextContent("Lieux");
  });
  it("page courante faite, rien après : retour à la première", () => {
    const ws = readyWs();
    ws.levels = [];
    ws.places[0].availability = {};
    ws.levels = [{ id: "x", name: "6e", mode: "trimestre", sportIds: [] }];
    setWs({ ...ws });
    renderAt(<StepGuide />, "/");
    expect(next()).toHaveTextContent("Classes");
  });
  it("page courante faite, étapes suivantes faites : première à faire", () => {
    const ws = readyWs();
    ws.levels = ws.levels.slice(0, 1);
    setWs(ws);
    renderAt(<StepGuide />, "/lieux");
    expect(next()).toHaveTextContent("Classes");
  });
  it("prêt : bouton générer hors planning", () => {
    setWs(readyWs());
    renderAt(<StepGuide />, "/sports");
    expect(screen.getByText("Générer le planning")).toBeInTheDocument();
    expect(next()).toBeNull();
  });
  it("masqué sur le planning avec des solutions", () => {
    setWs(readyWs());
    useStore.setState({ result: { status: "ok", solutions: [{ index: 0, plan: {}, assignments: [], violations: [] }], totalFound: 1, truncated: false, issues: [] } });
    renderAt(<StepGuide />, "/");
    expect(screen.queryByRole("list")).toBeNull();
  });
});
