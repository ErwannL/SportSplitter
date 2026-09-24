import { describe, expect, it } from "vitest";
import { brushCovered, removeBrush } from "./periods";

describe("periods", () => {
  it("cas limites", () => {
    expect(removeBrush(["Q1"], "all")).toEqual([]);
    expect(removeBrush(["Q1"], "erase")).toEqual([]);
    expect(brushCovered([], "erase")).toBe(true);
    expect(brushCovered(["Q1", "Q2", "Q3", "Q4"], "all")).toBe(true);
  });
});
