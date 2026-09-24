import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Minus, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/ui";
import { useT } from "../prefs";
import { useStore } from "../store";
import type { Preferences } from "../types";

const DAYS = 5;
const ROWS = 6;

/** Même calcul que le solveur : le jour compte avant l'heure. */
export function fillCost(pref: Preferences, day: number, row: number, days = DAYS, rows = ROWS): number {
  const h = { left: day, right: days - 1 - day, none: 0 }[pref.fillHorizontal];
  const v = { top: row, bottom: rows - 1 - row, none: 0 }[pref.fillVertical];
  return h * rows + v;
}

/** Rang de remplissage de chaque case d'une petite grille d'exemple (1 = remplie en premier). */
export function fillOrder(pref: Preferences): number[][] {
  const days = pref.saturday ? DAYS + 1 : DAYS;
  const costs = Array.from({ length: ROWS }, (_, r) => Array.from({ length: days }, (_, d) => fillCost(pref, d, r, days)));
  const distinct = [...new Set(costs.flat())].sort((a, b) => a - b);
  return costs.map((row) => row.map((c) => distinct.indexOf(c) + 1));
}

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition",
              value === o.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConfigurationPage() {
  const t = useT();
  const pref = useStore((s) => s.ws.preferences);
  const update = useStore((s) => s.updatePreferences);
  const order = fillOrder(pref);
  const max = Math.max(...order.flat());
  const days = ["L", "M", "M", "J", "V", ...(pref.saturday ? ["S"] : [])];

  return (
    <>
      <PageHeader title={t("config.title")} subtitle={t("config.subtitle")} />
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <CalendarDays size={18} className="text-indigo-600" /> {t("config.week")}
        </h2>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-slate-700">{t("config.saturday")}</span>
            <span className="block text-xs text-slate-400">{t("config.saturdayHint")}</span>
          </span>
          <button
            role="switch"
            aria-checked={pref.saturday}
            aria-label={t("config.saturday")}
            onClick={() => update({ saturday: !pref.saturday })}
            className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", pref.saturday ? "bg-indigo-600" : "bg-slate-300")}
          >
            <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-on shadow transition-all", pref.saturday ? "left-[22px]" : "left-0.5")} />
          </button>
        </label>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <SlidersHorizontal size={18} className="text-indigo-600" /> {t("config.fill")}
        </h2>
        <p className="mb-6 text-sm text-slate-500">{t("config.fillHint")}</p>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <Choice
              label={t("config.vertical")}
              value={pref.fillVertical}
              onChange={(fillVertical) => update({ fillVertical })}
              options={[
                { value: "top", label: t("config.top"), icon: <ArrowDown size={18} /> },
                { value: "bottom", label: t("config.bottom"), icon: <ArrowUp size={18} /> },
                { value: "none", label: t("config.none"), icon: <Minus size={18} /> },
              ]}
            />
            <Choice
              label={t("config.horizontal")}
              value={pref.fillHorizontal}
              onChange={(fillHorizontal) => update({ fillHorizontal })}
              options={[
                { value: "left", label: t("config.left"), icon: <ArrowRight size={18} /> },
                { value: "right", label: t("config.right"), icon: <ArrowLeft size={18} /> },
                { value: "none", label: t("config.none"), icon: <Minus size={18} /> },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">{t("config.preview")}</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} data-testid="fill-preview">
              {days.map((d, i) => (
                <div key={i} className="text-center text-xs font-semibold text-slate-400">
                  {d}
                </div>
              ))}
              {order.flat().map((n, i) => (
                <div
                  key={i}
                  className="flex h-9 items-center justify-center rounded-lg text-xs font-semibold text-on"
                  style={{ background: `rgb(79 70 229 / ${max === 1 ? 0.55 : 1 - ((n - 1) / (max - 1)) * 0.85})` }}
                >
                  {n}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">{t("config.previewHint")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
