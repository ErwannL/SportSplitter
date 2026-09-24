import clsx from "clsx";
import {
  Check, CircleHelp, CloudOff, GraduationCap, Home, Loader2, MapPin, Moon, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun,
  Volleyball,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { Key } from "../lib/i18n";
import { readiness } from "../lib/readiness";
import { canEditRules, usePrefs, useT } from "../prefs";
import { useStore } from "../store";
import { Onboarding } from "./Onboarding";
import { StepGuide } from "./StepGuide";

type StepKey = "timetable" | "levels" | "sports" | "places";

const NAV: { to: string; label: Key; icon: ReactNode; step: number; key: StepKey }[] = [
  { to: "/", label: "nav.planning", icon: <Home size={20} />, step: 1, key: "timetable" },
  { to: "/classes", label: "nav.classes", icon: <GraduationCap size={20} />, step: 2, key: "levels" },
  { to: "/sports", label: "nav.sports", icon: <Volleyball size={20} />, step: 3, key: "sports" },
  { to: "/lieux", label: "nav.places", icon: <MapPin size={20} />, step: 4, key: "places" },
];

const linkClass = (collapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  clsx(
    "group flex items-center gap-3 rounded-xl px-3 py-3 transition",
    collapsed && "justify-center",
    isActive ? "bg-indigo-600 text-on shadow-lg shadow-indigo-950/40" : "hover:bg-side-hover hover:text-on",
  );

function SideButton({ label, onClick, icon, collapsed }: { label: string; onClick: () => void; icon: ReactNode; collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-side-hover hover:text-on", collapsed && "justify-center")}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export function Layout() {
  const t = useT();
  const ws = useStore((s) => s.ws);
  const save = useStore((s) => s.save);
  const { collapsed, toggleCollapsed, theme, setTheme, lang, setLang, me, openOnboarding } = usePrefs();
  const status = readiness(ws);
  const onAdmin = useLocation().pathname.startsWith("/admin");

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className={clsx("flex shrink-0 flex-col bg-side text-side-text transition-[width]", collapsed ? "w-20" : "w-64")}>
        <div className={clsx("flex h-16 items-center gap-3", collapsed ? "justify-center" : "px-5")}>
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          {!collapsed && <span className="text-lg font-bold tracking-tight text-on">SportsSplitter</span>}
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end title={t(n.label)} className={linkClass(collapsed)}>
              <span className="relative">
                {n.icon}
                {collapsed && status[n.key] && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-on ring-2 ring-side">
                    <Check size={9} strokeWidth={4} />
                  </span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-sm font-medium">{t(n.label)}</span>
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      status[n.key] ? "bg-emerald-500/20 text-emerald-400" : "bg-side-hover text-side-muted",
                    )}
                  >
                    {status[n.key] ? <Check size={13} strokeWidth={3} /> : n.step}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          {canEditRules(me) && (
            <NavLink to="/admin" title={t("nav.admin")} className={({ isActive }) => clsx(linkClass(collapsed)({ isActive }), "mt-4")}>
              <ShieldCheck size={20} />
              {!collapsed && <span className="flex-1 text-sm font-medium">{t("nav.admin")}</span>}
            </NavLink>
          )}
        </nav>

        <div className="flex flex-col gap-1 px-3 pb-3">
          <SideButton collapsed={collapsed} label={t("nav.help")} icon={<CircleHelp size={18} />} onClick={openOnboarding} />
          <SideButton
            collapsed={collapsed}
            label={theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
            icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
          <div className={clsx("flex items-center gap-1 rounded-xl p-1", collapsed ? "flex-col" : "bg-side-hover/60")} role="group" aria-label={t("nav.language")}>
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={clsx(
                  "flex-1 rounded-lg px-2 py-1 text-xs font-semibold uppercase transition",
                  lang === l ? "bg-indigo-600 text-on" : "hover:text-on",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-side-hover" />
          <div className={clsx("flex items-center gap-2 px-3 py-1.5 text-xs", collapsed && "justify-center")} title={t("save.hint")}>
            {save === "saving" && <Loader2 size={14} className="shrink-0 animate-spin" />}
            {(save === "saved" || save === "idle") && <Check size={14} className="shrink-0 text-emerald-400" />}
            {save === "offline" && <CloudOff size={14} className="shrink-0 text-amber-400" />}
            {!collapsed && (
              <span className={save === "offline" ? "text-amber-400" : ""}>
                {t(save === "saving" ? "save.saving" : save === "offline" ? "save.offline" : "save.saved")}
              </span>
            )}
          </div>
          <SideButton
            collapsed={collapsed}
            label={collapsed ? t("nav.expand") : t("nav.collapse")}
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={toggleCollapsed}
          />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-10">
          {!onAdmin && <StepGuide />}
          <Outlet />
        </div>
      </main>
      <Onboarding />
    </div>
  );
}
