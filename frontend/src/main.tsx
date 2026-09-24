import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "./components/Layout";
import { ClassesPage } from "./pages/Classes";
import { PlacesPage } from "./pages/Places";
import { PlanningPage } from "./pages/Planning";
import { SportsPage } from "./pages/Sports";
import { useStore } from "./store";
import "./index.css";

function App() {
  const { loaded, load } = useStore();
  useEffect(() => {
    load();
  }, [load]);
  if (!loaded)
    return (
      <div className="flex h-screen items-center justify-center text-indigo-600">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PlanningPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="sports" element={<SportsPage />} />
          <Route path="lieux" element={<PlacesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
