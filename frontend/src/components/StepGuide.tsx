import clsx from "clsx";
import { ArrowRight, Check, Send } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { Key } from "../lib/i18n";
import { isReady, readiness } from "../lib/readiness";
import { useT } from "../prefs";
import { useStore } from "../store";

const STEPS: { to: string; key: "timetable" | "levels" | "sports" | "places"; label: Key; nav: Key }[] = [
  { to: "/", key: "timetable", label: "guide.step1", nav: "nav.planning" },
  { to: "/classes", key: "levels", label: "guide.step2", nav: "nav.classes" },
  { to: "/sports", key: "sports", label: "guide.step3", nav: "nav.sports" },
  { to: "/lieux", key: "places", label: "guide.step4", nav: "nav.places" },
];

/** Bandeau de progression : où j'en suis et quelle est la prochaine étape. */
export function StepGuide() {
  const t = useT();
  const ws = useStore((s) => s.ws);
  const result = useStore((s) => s.result);
  const path = useLocation().pathname;
  const status = readiness(ws);
  const ready = isReady(status);
  const onPlanning = path === "/";
  if (onPlanning && result?.solutions.length) return null;

  const firstTodo = STEPS.find((s) => !status[s.key]);
  const current = STEPS.findIndex((s) => s.to === path);
  // prochaine étape : la suivante dans l'ordre si la page courante est faite, sinon la première à faire
  const next = ready
    ? null
    : current >= 0 && status[STEPS[current].key]
      ? (STEPS.slice(current + 1).find((s) => !status[s.key]) ?? firstTodo)
      : firstTodo;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <ol className="flex flex-1 flex-wrap items-center gap-1 text-sm" aria-label={t("guide.title")}>
        {STEPS.map((s, i) => {
          const done = status[s.key];
          const active = s.to === path;
          return (
            <li key={s.to} className="flex items-center gap-1">
              <Link
                to={s.to}
                aria-current={active ? "step" : undefined}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 transition",
                  active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-500 hover:bg-slate-100",
                )}
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    done ? "bg-emerald-500 text-on" : active ? "bg-indigo-600 text-on" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden xl:inline">{t(s.label)}</span>
              </Link>
              <span className="text-slate-300">›</span>
            </li>
          );
        })}
        <li>
          <Link
            to="/"
            className={clsx(
              "flex items-center gap-2 rounded-full px-3 py-1.5 transition",
              ready ? "font-semibold text-indigo-700 hover:bg-indigo-50" : "text-slate-400",
            )}
          >
            <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full", ready ? "bg-indigo-600 text-on" : "bg-slate-200")}>
              <Send size={11} />
            </span>
            <span className="hidden xl:inline">{t("guide.step5")}</span>
          </Link>
        </li>
      </ol>

      {ready && !onPlanning && (
        <Link to="/?run=1" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-on shadow-sm hover:bg-indigo-500">
          {t("guide.goGenerate")} <ArrowRight size={16} />
        </Link>
      )}
      {next && next.to !== path && (
        <Link to={next.to} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-50 hover:opacity-90">
          {t("common.next", { label: t(next.nav) })} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
