import clsx from "clsx";
import { Lock, RotateCcw, ShieldCheck, Snowflake } from "lucide-react";
import type { ReactNode } from "react";
import { Button, PageHeader, Segmented } from "../components/ui";
import { segmentKey } from "../lib/i18n";
import { SEGMENTS } from "../lib/periods";
import { canEditRules, usePrefs, useT } from "../prefs";
import { defaultSettings, useStore } from "../store";
import type { Settings } from "../types";

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
        <span className="text-indigo-600">{icon}</span> {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function NumberInput({ value, min, max, step = 1, onChange, disabled }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none focus:border-indigo-400 disabled:opacity-50"
    />
  );
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-indigo-600" : "bg-slate-300")}
    >
      <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-on shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function AdminPage() {
  const t = useT();
  const me = usePrefs((p) => p.me);
  const settings = useStore((s) => s.ws.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const editable = canEditRules(me);
  const set = (patch: Partial<Settings>) => editable && updateSettings(patch);

  return (
    <>
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        actions={
          <>
            <span className="flex items-center gap-2 rounded-xl bg-white px-3 text-sm text-slate-500 ring-1 ring-slate-200">
              <ShieldCheck size={16} className="text-indigo-600" /> {t("admin.role", { role: me.role })}
            </span>
            <Button onClick={() => set(defaultSettings())} disabled={!editable}>
              <RotateCcw size={16} /> {t("admin.reset")}
            </Button>
          </>
        }
      />
      {!editable && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock size={16} /> {t("admin.readonly")}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("admin.winter")} icon={<Snowflake size={18} />}>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">{t("admin.winterRule")}</div>
            <Segmented
              value={settings.winterRule}
              onChange={(winterRule) => set({ winterRule })}
              options={[
                { value: "soft", label: t("admin.winter.soft") },
                { value: "hard", label: t("admin.winter.hard") },
                { value: "off", label: t("admin.winter.off") },
              ]}
            />
          </div>
          {settings.winterRule === "soft" && (
            <Field label={t("admin.maxWinter")}>
              <NumberInput value={settings.maxWinterViolations} min={0} max={50} disabled={!editable} onChange={(maxWinterViolations) => set({ maxWinterViolations })} />
            </Field>
          )}
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">{t("admin.winterSegments")}</div>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((seg) => {
                const on = settings.winterSegments.includes(seg);
                return (
                  <button
                    key={seg}
                    aria-pressed={on}
                    disabled={!editable}
                    onClick={() => set({ winterSegments: on ? settings.winterSegments.filter((x) => x !== seg) : SEGMENTS.filter((x) => x === seg || settings.winterSegments.includes(x)) })}
                    className={clsx(
                      "flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm transition disabled:opacity-50",
                      on ? "border-sky-400 bg-sky-500/10 text-sky-600" : "border-slate-200 text-slate-500",
                    )}
                  >
                    {on && <Snowflake size={12} />} {t(segmentKey(seg))}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title={t("admin.classes")} icon={<ShieldCheck size={18} />}>
          <Field label={t("admin.priorityRequired")} hint={t("admin.priorityRequiredHint")}>
            <Switch label={t("admin.priorityRequired")} checked={settings.priorityRequired} disabled={!editable} onChange={(priorityRequired) => set({ priorityRequired })} />
          </Field>
          <Field label={t("admin.allowRepeat")}>
            <Switch label={t("admin.allowRepeat")} checked={settings.allowRepeat} disabled={!editable} onChange={(allowRepeat) => set({ allowRepeat })} />
          </Field>
          <Field label={t("admin.sameDay")} hint={t("admin.sameDayHint")}>
            <Switch label={t("admin.sameDay")} checked={settings.sameDayAllowed} disabled={!editable} onChange={(sameDayAllowed) => set({ sameDayAllowed })} />
          </Field>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">{t("admin.separate")}</div>
            <Segmented
              value={settings.separatePlacesRule}
              onChange={(separatePlacesRule) => set({ separatePlacesRule })}
              options={[
                { value: "hard", label: t("admin.separate.hard") },
                { value: "soft", label: t("admin.separate.soft") },
                { value: "off", label: t("admin.separate.off") },
              ]}
            />
          </div>
          {settings.separatePlacesRule === "soft" && (
            <Field label={t("admin.maxSeparate")}>
              <NumberInput value={settings.maxSeparateViolations} min={0} max={50} disabled={!editable} onChange={(maxSeparateViolations) => set({ maxSeparateViolations })} />
            </Field>
          )}
          <Field label={t("admin.barretteMin")}>
            <NumberInput value={settings.barretteMinGroups} min={2} max={10} disabled={!editable} onChange={(barretteMinGroups) => set({ barretteMinGroups })} />
          </Field>
        </Card>

        <Card title={t("admin.search")} icon={<RotateCcw size={18} />}>
          <Field label={t("admin.maxSolutions")}>
            <NumberInput value={settings.maxSolutions} min={1} max={5000} disabled={!editable} onChange={(maxSolutions) => set({ maxSolutions })} />
          </Field>
          <Field label={t("admin.timeLimit")}>
            <NumberInput value={settings.timeLimit} min={1} max={600} disabled={!editable} onChange={(timeLimit) => set({ timeLimit })} />
          </Field>
        </Card>
      </div>
    </>
  );
}
