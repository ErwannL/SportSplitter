import { describe, expect, it } from "vitest";
import { DICTS, periodKey, segmentKey, translate, translateCode } from "./i18n";

describe("i18n", () => {
  it("dictionnaires alignés", () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.fr).sort());
  });
  it("translate garde les paramètres manquants", () => {
    expect(translate("en", "ready.missingLevel")).toContain("{level}");
    expect(translate("en", "ready.missingLevel", { level: "6e" })).toContain("6e");
  });
  it("translateCode", () => {
    expect(translateCode("en", "unknown", {}, "fb")).toBe("fb");
    expect(translateCode("en", "relaxed", undefined, "fb")).toBe("fb");
    expect(translateCode("en", "winter_outdoor", { level: "A", place: "B", period: "T1" }, "fb")).toContain(
      DICTS.en["period.T1"],
    );
    expect(translateCode("en", "winter_outdoor", { level: "A", place: "B", period: "ZZ" }, "fb")).toContain("ZZ");
    expect(translateCode("fr", "winter_outdoor", { level: "A", place: "B", period: 3 }, "fb")).toContain("3");
  });
  it("clés dérivées", () => {
    expect(segmentKey("Q1")).toBe("segment.Q1");
    expect(periodKey("S2")).toBe("period.S2");
  });
});
