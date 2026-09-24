import { create } from "zustand";
import { api, AuthError, DEFAULT_ORQEA_URL, setUnauthorizedHandler } from "./lib/api";
import { usePrefs } from "./prefs";
import { useStore } from "./store";
import type { Me } from "./types";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "unreachable";

interface AuthState {
  status: AuthStatus;
  me: Me | null;
  orqeaUrl: string;
  /** Vérifie la session (GET /api/me) et charge l'espace de l'utilisateur. */
  check: () => Promise<void>;
  /** Session expirée en cours d'usage : garde la modification localement et affiche « Accès via Orqea ». */
  expire: (err: AuthError) => void;
  logout: () => Promise<void>;
}

const NO_RIGHTS: Me = { sub: "", email: "", name: "", role: "user", permissions: [] };

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  me: null,
  orqeaUrl: DEFAULT_ORQEA_URL,

  async check() {
    try {
      const me = await api.me();
      usePrefs.getState().setMe(me);
      await useStore.getState().load(me.sub);
      set({ status: "authenticated", me });
    } catch (e) {
      if (e instanceof AuthError) set({ status: "anonymous", me: null, orqeaUrl: e.orqeaUrl });
      else set({ status: "unreachable", me: null });
    }
  },

  expire(err) {
    if (get().status !== "authenticated") return;
    const store = useStore.getState();
    void store.flush(); // la copie locale (marquée non synchronisée) est écrite avant l'appel réseau
    store.clear();
    usePrefs.getState().setMe(NO_RIGHTS);
    set({ status: "anonymous", me: null, orqeaUrl: err.orqeaUrl });
  },

  async logout() {
    await useStore.getState().flush();
    try {
      await api.logout();
    } catch {
      /* serveur injoignable : on se déconnecte quand même côté navigateur */
    } finally {
      useStore.getState().clear();
      usePrefs.getState().setMe(NO_RIGHTS);
      set({ status: "anonymous", me: null });
    }
  },
}));

setUnauthorizedHandler((err) => useAuth.getState().expire(err));
