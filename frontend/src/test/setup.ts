import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useAuth } from "../auth";
import { usePrefs } from "../prefs";
import { ADMIN_ME } from "./utils";
import { useStore } from "../store";

const initialStore = useStore.getState();
const initialPrefs = usePrefs.getState();
const initialAuth = useAuth.getState();

beforeEach(() => {
  if (typeof window === "undefined") return;
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  useStore.setState(initialStore, true);
  usePrefs.setState({ ...initialPrefs, me: ADMIN_ME, onboardingOpen: false }, true);
  // les pages de l'application supposent une session ouverte ; les tests d'accès la remettent à "loading"
  useAuth.setState({ ...initialAuth, status: "authenticated", me: ADMIN_ME }, true);
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
