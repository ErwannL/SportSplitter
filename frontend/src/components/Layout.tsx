import clsx from "clsx";
import { Check, CloudOff, GraduationCap, Home, Loader2, MapPin, Volleyball } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { readiness } from "../lib/readiness";
import { useStore } from "../store";

const NAV: { to: string; label: string; icon: ReactNode; step: number; key: "timetable" | "levels" | "sports" | "places" }[] = [
  { to: "/", label: "Planning", icon: <Home size={20} />, step: 1, key: "timetable" },
  { to: "/classes", label: "Classes", icon: <GraduationCap size={20} />, step: 2, key: "levels" },
  { to: "/sports", label: "Sports", icon: <Volleyball size={20} />, step: 3, key: "sports" },
  { to: "/lieux", label: "Lieux", icon: <MapPin size={20} />, step: 4, key: "places" },
];

export function Layout() {
  const ws = useStore((s) => s.ws);
  const save = useStore((s) => s.save);
  const status = readiness(ws);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-20 shrink-0 flex-col bg-slate-900 text-slate-400 lg:w-64">
        <div className="flex h-16 items-center gap-3 px-5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="hidden text-lg font-bold tracking-tight text-white lg:block">SportsSplitter</span>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 transition",
                  isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "hover:bg-slate-800 hover:text-white",
                )
              }
            >
              <span className="relative">
                {n.icon}
                {status[n.key] && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-slate-900 lg:hidden">
                    <Check size={9} strokeWidth={4} />
                  </span>
                )}
              </span>
              <span className="hidden flex-1 text-sm font-medium lg:block">{n.label}</span>
              <span
                className={clsx(
                  "hidden h-6 w-6 items-center justify-center rounded-full text-xs font-semibold lg:flex",
                  status[n.key] ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500",
                )}
              >
                {status[n.key] ? <Check size={13} strokeWidth={3} /> : n.step}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-4 text-xs lg:block">
          {save === "saving" && (
            <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Enregistrement…</span>
          )}
          {save === "saved" && <span className="flex items-center gap-2"><Check size={14} /> Enregistré</span>}
          {save === "offline" && (
            <span className="flex items-center gap-2 text-amber-400"><CloudOff size={14} /> Hors ligne (sauvegarde locale)</span>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
