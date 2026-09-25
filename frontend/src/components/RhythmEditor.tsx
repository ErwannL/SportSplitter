import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";
import { useT } from "../prefs";
import { IconButton } from "./ui";

export const DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];

export const RHYTHM_PRESETS: { label: string; cycle: number[][] }[] = [
  { label: "1h", cycle: [[60]] },
  { label: "2h", cycle: [[120]] },
  { label: "2×2h30", cycle: [[150, 150]] },
  { label: "2h / 4h", cycle: [[120], [240]] },
  { label: "4×1h / 2×1h30 / –", cycle: [[60, 60, 60, 60], [90, 90], []] },
];

export function fmtDuration(m: number): string {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  if (!h) return `${mn}min`;
  return mn ? `${h}h${String(mn).padStart(2, "0")}` : `${h}h`;
}

/** Durée moyenne d'EPS par semaine sur le cycle. */
export function weeklyAverage(cycle: number[][]): number {
  return Math.round(cycle.flat().reduce((a, b) => a + b, 0) / cycle.length);
}

/** Édition du rythme d'un niveau : cycle de 1 à 4 semaines, séances par semaine. */
export function RhythmEditor({ cycle, onChange }: { cycle: number[][]; onChange: (c: number[][]) => void }) {
  const t = useT();
  const setWeeks = (n: number) =>
    onChange(Array.from({ length: n }, (_, i) => cycle[i] ?? [...(cycle[cycle.length - 1] ?? [])]));
  const setWeek = (w: number, sessions: number[]) => onChange(cycle.map((s, i) => (i === w ? sessions : s)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-100 p-0.5" title={t("classes.cycleHint")} role="radiogroup" aria-label={t("classes.cycleHint")}>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={cycle.length === n}
              onClick={() => setWeeks(n)}
              className={clsx(
                "rounded-md px-2 py-0.5 text-xs font-medium transition",
                cycle.length === n ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t("classes.cycleWeeks", { n })}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{t("classes.average", { total: fmtDuration(weeklyAverage(cycle)) })}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {RHYTHM_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.cycle.map((w) => [...w]))}
            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            {p.label}
          </button>
        ))}
      </div>
      {cycle.map((week, w) => (
        <div key={w} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
          {cycle.length > 1 && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("classes.week", { w: String.fromCharCode(65 + w) })}</div>}
          <div className="flex flex-wrap items-center gap-1">
            {week.length === 0 && <span className="text-xs italic text-slate-400">{t("classes.noPE")}</span>}
            {week.map((m, k) => (
              <span key={k} className="flex items-center gap-1 rounded-lg bg-indigo-50 py-0.5 pl-2 pr-1 text-xs font-medium text-indigo-700">
                {fmtDuration(m)}
                <button
                  aria-label={t("classes.removeSession", { d: fmtDuration(m) })}
                  onClick={() => setWeek(w, week.filter((_, i) => i !== k))}
                  className="rounded opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <select
              aria-label={t("classes.addSession")}
              value=""
              onChange={(e) => setWeek(w, [...week, Number(e.target.value)])}
              className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-transparent px-1.5 py-0.5 text-xs text-slate-500 outline-none hover:border-indigo-300 hover:text-indigo-600"
            >
              <option value="" disabled>
                + {t("classes.addSession")}
              </option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {fmtDuration(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Petit compteur − n + */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1" title={label}>
      <IconButton label={t("common.less")} disabled={value <= min} onClick={() => onChange(value - 1)} className="disabled:opacity-30">
        <Minus size={14} />
      </IconButton>
      <span className="w-5 text-center text-sm font-semibold">{value}</span>
      <IconButton label={t("common.more")} disabled={value >= max} onClick={() => onChange(value + 1)} className="disabled:opacity-30">
        <Plus size={14} />
      </IconButton>
    </div>
  );
}
