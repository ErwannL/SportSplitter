import { describe, expect, it } from "vitest";
import { applyBrush, brushCovered, removeBrush } from "./periods";

describe("pinceaux de disponibilité", () => {
  it("ajoute les segments d'une période", () => {
    expect(applyBrush([], "S1")).toEqual(["Q1", "Q2"]);
    expect(applyBrush(["Q4"], "T2")).toEqual(["Q2", "Q3", "Q4"]);
    expect(applyBrush(["Q1"], "all")).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });
  it("retire et efface", () => {
    expect(removeBrush(["Q1", "Q2", "Q3"], "T2")).toEqual(["Q1"]);
    expect(applyBrush(["Q1"], "erase")).toEqual([]);
  });
  it("détecte une case déjà couverte", () => {
    expect(brushCovered(["Q1", "Q2"], "S1")).toBe(true);
    expect(brushCovered(["Q1"], "S1")).toBe(false);
  });
});
