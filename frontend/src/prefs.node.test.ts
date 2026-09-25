// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("prefs hors navigateur", () => {
  it("utilise les valeurs par défaut sans window ni localStorage", async () => {
    const { readPrefs } = await import("./prefs");
    expect(readPrefs()).toEqual({ theme: "light", lang: "fr", collapsed: false, onboarded: false });
  });
});
