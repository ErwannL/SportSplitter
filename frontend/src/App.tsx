import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { AccessScreen, LoadingScreen, UnreachableScreen } from "./pages/Access";
import { AdminPage } from "./pages/Admin";
import { ClassesPage } from "./pages/Classes";
import { ConfigurationPage } from "./pages/Configuration";
import { PlacesPage } from "./pages/Places";
import { PlanningPage } from "./pages/Planning";
import { SportsPage } from "./pages/Sports";
import { SsoPage } from "./pages/Sso";
import { applyTheme, canEditRules, usePrefs } from "./prefs";
import { useStore } from "./store";

export function AppRoutes() {
  const me = usePrefs((p) => p.me);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PlanningPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="sports" element={<SportsPage />} />
        <Route path="lieux" element={<PlacesPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
        <Route path="admin" element={canEditRules(me) ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** Rien de l'application n'est rendu sans session valide. */
export function AuthGate() {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <LoadingScreen />;
  if (status === "anonymous") return <AccessScreen />;
  if (status === "unreachable") return <UnreachableScreen />;
  return <AppRoutes />;
}

export function App() {
  useEffect(() => {
    applyTheme(usePrefs.getState().theme);
    // la page /sso ouvre elle-même la session avant de vérifier
    if (window.location.pathname !== "/sso") void useAuth.getState().check();
    const flush = () => void useStore.getState().flush();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sso" element={<SsoPage />} />
        <Route path="*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  );
}
