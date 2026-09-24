import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { usePrefs } from "../prefs";
import { useStore } from "../store";

const initialStore = useStore.getState();
const initialPrefs = usePrefs.getState();

beforeEach(() => {
  if (typeof window === "undefined") return;
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  useStore.setState(initialStore, true);
  usePrefs.setState({ ...initialPrefs, onboardingOpen: false }, true);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

afterEach(async () => {
  if (typeof window === "undefined") return;
  cleanup();
  await useStore.getState().flush();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
