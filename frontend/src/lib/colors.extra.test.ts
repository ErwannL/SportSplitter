import { describe, expect, it } from "vitest";
import { balanced, hash, hexToRgb, isTooClose, luminance, placeColor, textOn } from "./colors";

describe("colors", () => {
  it("hash / hexToRgb", () => {
    expect(hash("")).toBe(0x811c9dc5);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("zzz")).toEqual([0, 0, 0]);
  });
  it("luminance et texte", () => {
    expect(luminance("#000000")).toBe(0);
    expect(textOn("#ffffff")).toBe("#0f172a");
    expect(textOn("#000000")).toBe("#ffffff");
  });
  it("balanced corrige les extrêmes", () => {
    expect(luminance(balanced(240, 100, 5))).toBeGreaterThanOrEqual(0.12);
    expect(luminance(balanced(60, 100, 95))).toBeLessThanOrEqual(0.55);
  });
  it("isTooClose", () => {
    expect(isTooClose("#000000", ["#010101"])).toBe(true);
    expect(isTooClose("#000000", ["#ffffff"])).toBe(false);
  });
  it("placeColor retourne la meilleure couleur quand tout est proche", () => {
    const existing = Array.from({ length: 72 }, (_, i) => balanced(i * 5, 70, 50));
    const c = placeColor("x", "y", existing);
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
