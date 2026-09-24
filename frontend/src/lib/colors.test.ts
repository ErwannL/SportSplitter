import { describe, expect, it } from "vitest";
import { colorDistance, luminance, placeColor, TOO_CLOSE } from "./colors";

describe("placeColor", () => {
  it("donne des couleurs distinctes, ni trop sombres ni trop claires", () => {
    const used: string[] = [];
    for (const name of ["Gymnase", "Terrain collège", "Piscine", "Salle de danse", "Stade", "Dojo", "Mur"]) {
      const c = placeColor(name, `id_${name}`, used);
      expect(luminance(c)).toBeGreaterThanOrEqual(0.12);
      expect(luminance(c)).toBeLessThanOrEqual(0.55);
      for (const u of used) expect(colorDistance(c, u)).toBeGreaterThanOrEqual(TOO_CLOSE);
      used.push(c);
    }
  });
  it("est déterministe", () => {
    expect(placeColor("Gymnase", "a", [])).toBe(placeColor("Gymnase", "a", []));
  });
});
