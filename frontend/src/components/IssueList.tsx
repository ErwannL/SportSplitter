import clsx from "clsx";
import { AlertCircle, ArrowRight, Lightbulb, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { translateCode, translateFix } from "../lib/i18n";
import { readiness, targetLink } from "../lib/readiness";
import { usePrefs, useT } from "../prefs";
import { useStore } from "../store";
import type { TargetType } from "../types";

export function IssueItem({ to, message, fix, warning }: { to: string; message: string; fix: string | null; warning?: boolean }) {
  const t = useT();
  return (
    <li>
      <Link
        to={to}
        className={clsx(
          "group block rounded-xl border-l-4 bg-slate-50 px-3 py-2 text-sm transition hover:bg-indigo-50",
          warning ? "border-amber-400" : "border-rose-500",
        )}
      >
        <span className="flex items-start justify-between gap-2 text-slate-800">
          {message}
          <ArrowRight size={14} className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
        </span>
        {fix && (
          <span className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <Lightbulb size={13} className="mt-px shrink-0 text-amber-500" />
            <span>
              <b className="font-semibold text-slate-600">{t("fix.label")}</b> {fix}
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}

/** Problèmes qui concernent l'onglet courant : configuration incomplète et dernier calcul impossible. */
export function TabIssues({ types }: { types: TargetType[] }) {
  const t = useT();
  const lang = usePrefs((p) => p.lang);
  const ws = useStore((s) => s.ws);
  const last = useStore((s) => s.lastIssues);
  const live = readiness(ws).problems.filter((p) => types.includes(p.targetType));
  const solved = (last?.issues ?? [])
    .filter((i) => i.targetType && types.includes(i.targetType))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  if (!live.length && !solved.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm" aria-label={t("issues.title")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-rose-600">
          <AlertCircle size={18} /> {t("issues.title")}
        </h2>
        {last?.stale && solved.length > 0 && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{t("issues.stale")}</span>
        )}
        {solved.length > 0 && (
          <Link to="/" className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
            <RefreshCw size={13} /> {t("issues.rerun")}
          </Link>
        )}
      </div>
      <ul className="grid max-h-80 gap-2 overflow-y-auto lg:grid-cols-2">
        {live.map((p, k) => (
          <IssueItem key={`l${k}`} to={targetLink(p.targetType, p.target, ws)} message={t(p.key, p.params)} fix={translateFix(lang, p.key, p.params)} />
        ))}
        {solved.map((i, k) => (
          <IssueItem
            key={`s${k}`}
            to={targetLink(i.targetType, i.target, ws)}
            message={translateCode(lang, i.code, i.params, i.message)}
            fix={translateFix(lang, i.code, i.params)}
            warning={i.severity === "warning"}
          />
        ))}
      </ul>
    </section>
  );
}

/** Pastille sur une colonne (niveau, sport, lieu) concernée par un problème du dernier calcul. */
export function IssueBadge({ id }: { id: string }) {
  const t = useT();
  const count = useStore((s) => (s.lastIssues?.issues ?? []).filter((i) => i.target === id && i.severity === "error").length);
  if (!count) return null;
  return (
    <span title={t("issues.badge", { count })} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-on">
      {count}
    </span>
  );
}
