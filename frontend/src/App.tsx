import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { api } from "./lib/api";
import { AdminPage } from "./pages/Admin";
import { ClassesPage } from "./pages/Classes";
import { ConfigurationPage } from "./pages/Configuration";
import { PlacesPage } from "./pages/Places";
import { PlanningPage } from "./pages/Planning";
import { SportsPage } from "./pages/Sports";
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

export function App() {
  const { loaded, load } = useStore();
  const setMe = usePrefs((p) => p.setMe);
  useEffect(() => {
    applyTheme(usePrefs.getState().theme);
    load();
    api.me().then(setMe, () => undefined);
    const flush = () => void useStore.getState().flush();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [load, setMe]);
  if (!loaded)
    return (
      <div className="flex h-screen items-center justify-center text-indigo-600">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
