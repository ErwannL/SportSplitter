import { create } from "zustand";
import { translate, type Key, type Lang } from "./lib/i18n";
import type { Me, Params } from "./types";

export type Theme = "light" | "dark";

const KEY = "sportsplitter.prefs";

interface Stored {
  theme: Theme;
  lang: Lang;
  collapsed: boolean;
  onboarded: boolean;
}

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readPrefs(): Stored {
  const defaults: Stored = { theme: systemTheme(), lang: "fr", collapsed: false, onboarded: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

interface PrefsState extends Stored {
  me: Me;
  onboardingOpen: boolean;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  toggleCollapsed: () => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  setMe: (me: Me) => void;
}

function persist(s: Stored) {
  localStorage.setItem(KEY, JSON.stringify({ theme: s.theme, lang: s.lang, collapsed: s.collapsed, onboarded: s.onboarded }));
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.lang = usePrefs.getState().lang;
}

export const usePrefs = create<PrefsState>((set, get) => {
  const initial = readPrefs();
  const update = (patch: Partial<Stored>) => {
    set(patch);
    persist(get());
  };
  return {
    ...initial,
    // en développement, tout le monde est administrateur (remplacé par /api/me au démarrage)
    me: { role: "admin", permissions: ["edit_workspace", "edit_rules"] },
    onboardingOpen: !initial.onboarded,
    setTheme: (theme) => {
      update({ theme });
      applyTheme(theme);
    },
    setLang: (lang) => {
      update({ lang });
      document.documentElement.lang = lang;
    },
    toggleCollapsed: () => update({ collapsed: !get().collapsed }),
    openOnboarding: () => set({ onboardingOpen: true }),
    closeOnboarding: () => {
      update({ onboarded: true });
      set({ onboardingOpen: false });
    },
    setMe: (me) => set({ me }),
  };
});

/** Fonction de traduction liée à la langue courante. */
export function useT() {
  const lang = usePrefs((s) => s.lang);
  return (key: Key, params?: Params) => translate(lang, key, params);
}

export const canEditRules = (me: Me) => me.permissions.includes("edit_rules");
