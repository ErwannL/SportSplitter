import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyTheme, canEditRules, readPrefs, usePrefs, useT } from "./prefs";

const p = () => usePrefs.getState();

describe("prefs", () => {
  it("readPrefs : défauts, stockage, JSON invalide, thème système", () => {
    expect(readPrefs().theme).toBe("light");
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    expect(readPrefs().theme).toBe("dark");
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    expect(readPrefs().theme).toBe("light");
    localStorage.setItem("sportsplitter.prefs", JSON.stringify({ lang: "en" }));
    expect(readPrefs().lang).toBe("en");
    localStorage.setItem("sportsplitter.prefs", "{oops");
    expect(readPrefs().lang).toBe("fr");
  });
  it("actions", () => {
    p().setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    p().setLang("en");
    expect(document.documentElement.lang).toBe("en");
    p().toggleCollapsed();
    expect(p().collapsed).toBe(true);
    p().openOnboarding();
    expect(p().onboardingOpen).toBe(true);
    p().closeOnboarding();
    expect(p().onboardingOpen).toBe(false);
    expect(JSON.parse(localStorage.getItem("sportsplitter.prefs")!)).toMatchObject({ onboarded: true, lang: "en" });
    p().setMe({ role: "prof", permissions: [] });
    expect(canEditRules(p().me)).toBe(false);
  });
  it("useT", () => {
    const { result } = renderHook(() => useT());
    expect(result.current("nav.sports")).toBe("Sports");
  });
});
