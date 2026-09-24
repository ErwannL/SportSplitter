import clsx from "clsx";
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Download, FileSpreadsheet, Loader2, RefreshCw,
  Send, Shuffle, Snowflake, Upload, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { textOn } from "../lib/colors";
import { periodKey, segmentKey, translateCode, translateFix } from "../lib/i18n";
import { usePrefs, useT } from "../prefs";
import { IssueItem } from "../components/IssueList";
import { TimetableGrid } from "../components/TimetableGrid";
import { Button, IconButton, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { MODE_PERIODS, PERIODS, SEGMENT_HINT, SEGMENTS } from "../lib/periods";
import { isReady, readiness, targetLink } from "../lib/readiness";
import { useStore } from "../store";
import type { Cell, Segment, Solution, Workspace } from "../types";

export function PlanningPage() {
  const { ws, result } = useStore();
  if (!ws.timetable) return <ImportHero />;
  return result && result.solutions.length > 0 ? <ResultView /> : <SetupView />;
}

function useImport() {
  const setTimetable = useStore((s) => s.setTimetable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const handle = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setTimetable(await api.parseTimetable(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const picker = (
    <input ref={input} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
  );
  return { busy, error, handle, open: () => input.current?.click(), picker };
}

function ImportHero() {
  const t = useT();
  const imp = useImport();
  const [over, setOver] = useState(false);
  return (
    <>
      <PageHeader step={1} title={t("planning.title")} subtitle={t("planning.subtitle.import")} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          imp.handle(e.dataTransfer.files[0]);
        }}
        className={clsx(
          "flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-24 transition",
          over ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white",
        )}
      >
        {imp.picker}
        <button
          onClick={imp.open}
          disabled={imp.busy}
          className="flex items-center gap-5 rounded-full bg-slate-900 py-5 pl-8 pr-12 text-2xl font-medium text-on shadow-xl shadow-slate-900/20 transition hover:scale-[1.02] hover:bg-indigo-600 disabled:opacity-70"
        >
          {imp.busy ? <Loader2 size={34} className="animate-spin" /> : <Upload size={34} />}
          {t("planning.import")}
        </button>
        <p className="mt-5 text-sm text-slate-500">{t("planning.drop")}</p>
        <a href={api.templateUrl} className="mt-6 flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
          <FileSpreadsheet size={16} /> {t("planning.template")}
        </a>
        {imp.error && <ErrorBox text={imp.error} />}
      </div>
    </>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertCircle size={16} /> {text}
    </div>
  );
}

function SetupView() {
  const t = useT();
  const lang = usePrefs((p) => p.lang);
  const { ws, setResult, setTimetable } = useStore();
  const last = useStore((st) => st.lastIssues);
  const status = readiness(ws);
  const ready = isReady(status);
  const imp = useImport();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (cell: Cell) =>
    setTimetable({
      ...ws.timetable!,
      cells: ws.timetable!.cells.map((c) => (c.day === cell.day && c.row === cell.row ? { ...c, closed: !c.closed } : c)),
    });

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.solve(ws));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // « Relancer la génération » depuis un autre onglet : /?run=1
  const [params, setParams] = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (params.get("run") !== "1" || started.current) return;
    started.current = true;
    setParams({}, { replace: true });
    if (ready) void generate();
  });

  return (
    <>
      <PageHeader
        step={ready ? 5 : 1}
        title={t("planning.title")}
        subtitle={t(ready ? "planning.subtitle.ready" : "planning.subtitle.todo")}
        actions={
          <>
            {imp.picker}
            <span className="flex items-center gap-2 rounded-xl bg-white px-3 text-sm text-slate-500 ring-1 ring-slate-200">
              <FileSpreadsheet size={16} className="text-emerald-600" /> {ws.timetable!.fileName || t("planning.defaultFile")}
            </span>
            <Button onClick={imp.open} disabled={imp.busy}>
              <RefreshCw size={16} /> {t("planning.replace")}
            </Button>
            <IconButton label={t("planning.remove")} onClick={() => setTimetable(null)} className="h-10 w-10">
              <X size={18} />
            </IconButton>
          </>
        }
      />
      {imp.error && <ErrorBox text={imp.error} />}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="relative">
          <TimetableGrid
            timetable={ws.timetable!}
            dim={loading}
            cellClassName={(c) => (c.closed ? "cursor-pointer" : "cursor-pointer hover:bg-indigo-50/60")}
            onCellPointerDown={toggle}
            onClosedPointerDown={toggle}
            renderCell={(c) =>
              c.closed ? (
                <span className="flex h-full items-center justify-center text-[11px] font-medium uppercase tracking-wider text-slate-400">{t("planning.closed")}</span>
              ) : null
            }
          />
          <p className="mt-2 text-xs text-slate-500">{t("planning.gridHint")}</p>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Loader2 size={72} className="animate-spin text-indigo-600" strokeWidth={1.5} />
              <span className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow">{t("planning.searching")}</span>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-semibold">{t("planning.config")}</h3>
            <ul className="space-y-2 text-sm">
              {(
                [
                  ["planning.title", status.timetable, "/"],
                  ["nav.classes", status.levels, "/classes"],
                  ["nav.sports", status.sports, "/sports"],
                  ["nav.places", status.places, "/lieux"],
                ] as const
              ).map(([label, ok, to]) => (
                <li key={label}>
                  <Link to={to} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    {ok ? <CheckCircle2 size={18} className="text-emerald-500" /> : <CircleAlert size={18} className="text-amber-500" />}
                    <span className={ok ? "text-slate-700" : "font-medium text-slate-900"}>{t(label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {status.problems.length > 0 && (
              <ul className="mt-4 max-h-72 space-y-2 overflow-auto border-t border-slate-100 pt-3">
                {status.problems.map((p, k) => (
                  <IssueItem
                    key={k}
                    to={targetLink(p.targetType, p.target, ws)}
                    message={t(p.key, p.params)}
                    fix={translateFix(lang, p.key, p.params)}
                  />
                ))}
              </ul>
            )}
          </div>
          {last && (
            <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-rose-600"><AlertCircle size={18} /> {t("planning.none")}</h3>
              <p className="mb-3 text-xs text-slate-500">{t("planning.noneHint")}</p>
              {last.stale && <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">{t("issues.stale")}</p>}
              <ul className="-mr-2 max-h-[26rem] space-y-2 overflow-y-auto pr-2">
                {[...last.issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1)).map((i, k) => (
                  <IssueItem
                    key={k}
                    to={targetLink(i.targetType, i.target, ws)}
                    message={translateCode(lang, i.code, i.params, i.message)}
                    fix={translateFix(lang, i.code, i.params)}
                    warning={i.severity === "warning"}
                  />
                ))}
              </ul>
            </div>
          )}
          {error && <ErrorBox text={error} />}
        </aside>
      </div>

      <div className="pointer-events-none sticky bottom-4 z-10 mt-8 flex justify-center">
        <button
          onClick={generate}
          disabled={!ready || loading}
          title={t(ready ? "planning.generate" : "planning.generateLocked")}
          className="group pointer-events-auto flex h-16 items-center gap-3 rounded-full bg-indigo-600 px-8 text-lg font-semibold text-on shadow-xl shadow-indigo-600/30 transition hover:scale-[1.03] hover:bg-indigo-500 disabled:scale-100 disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Send className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
          {t("planning.generate")}
        </button>
      </div>
    </>
  );
}

interface SlotItem {
  level: string;
  sport: string;
  place: string;
  color: string;
  groups: number;
  outdoor: boolean;
  first: boolean;
  time: string;
}

/** Contenu de chaque case (jour-ligne) pour un segment de l'année et une semaine du cycle commun. */
export function slotContents(ws: Workspace, sol: Solution, seg: Segment, week: number) {
  const sports = new Map(ws.sports.map((s) => [s.id, s]));
  const places = new Map(ws.places.map((p) => [p.id, p]));
  const levels = new Map(ws.levels.map((l) => [l.id, l]));
  const rows = ws.timetable!.rows;
  const bySlot = new Map<string, SlotItem[]>();
  for (const a of sol.assignments) {
    const lv = levels.get(a.levelId);
    if (!lv || !PERIODS[a.period].includes(seg) || week % lv.cycle.length !== a.week) continue;
    const time = `${rows[a.row]?.start ?? ""} – ${rows[a.row + a.span - 1]?.end ?? ""}`;
    for (const p of a.placements) {
      const pl = places.get(p.placeId);
      for (let r = a.row; r < a.row + a.span; r++) {
        const id = `${a.day}-${r}`;
        const list = bySlot.get(id) ?? [];
        list.push({
          level: lv.name,
          sport: sports.get(a.sportId)?.name ?? "?",
          place: pl?.name ?? "?",
          color: pl?.color ?? "#94a3b8",
          groups: p.groups,
          outdoor: !!pl?.outdoor,
          first: r === a.row,
          time,
        });
        bySlot.set(id, list);
      }
    }
  }
  return bySlot;
}

function ResultView() {
  const t = useT();
  const lang = usePrefs((p) => p.lang);
  const { ws, result, setResult } = useStore();
  const [idx, setIdx] = useState(0);
  const [seg, setSeg] = useState<Segment>("Q1");
  const [week, setWeek] = useState(0);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const sols = result!.solutions;
  const sol = sols[Math.min(idx, sols.length - 1)];
  const contents = slotContents(ws, sol, seg, week % sol.weeks);
  const winter = new Set(ws.settings.winterSegments);
  const usedLevels = ws.levels.filter((l) => sol.plan[l.id]);

  const [exportError, setExportError] = useState(false);
  const exportSols = async (list: Solution[]) => {
    setMenu(false);
    setBusy(true);
    try {
      await api.exportSolutions(ws, list, lang);
      setExportError(false);
    } catch {
      setExportError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        step={6}
        title={t("result.title")}
        subtitle={t("result.subtitle", { count: `${result!.totalFound}${result!.truncated ? "+" : ""}` })}
        actions={
          <Button onClick={() => setResult(null)}>
            <ChevronLeft size={16} /> {t("result.back")}
          </Button>
        }
      />

      {result!.status === "relaxed" && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Snowflake size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{t("result.relaxed")}</b> {t("result.relaxedHint")}
            <ul className="mt-1 list-disc pl-5">
              {sol.violations.map((v, i) => (
                <li key={i}>{translateCode(lang, v.rule, v.params, v.message)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <IconButton label={t("result.prev")} onClick={() => setIdx((i) => (i - 1 + sols.length) % sols.length)}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-28 text-center text-sm font-medium">
            {t("result.solution")} {idx + 1} <span className="text-slate-400">/ {sols.length}</span>
          </span>
          <IconButton label={t("result.next")} onClick={() => setIdx((i) => (i + 1) % sols.length)}>
            <ChevronRight size={18} />
          </IconButton>
          <IconButton label={t("result.random")} onClick={() => setIdx(Math.floor(Math.random() * sols.length))}>
            <Shuffle size={16} />
          </IconButton>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              onClick={() => setSeg(s)}
              className={clsx(
                "flex flex-col items-center rounded-lg px-4 py-1 transition",
                seg === s ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              <span className="flex items-center gap-1 text-sm font-medium">
                {winter.has(s) && <Snowflake size={12} className="text-sky-500" />}
                {t(segmentKey(s))}
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-70">{SEGMENT_HINT[s]}</span>
            </button>
          ))}
        </div>

        {sol.weeks > 1 && (
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1" title={t("result.weeksHint", { n: sol.weeks })}>
            {Array.from({ length: sol.weeks }, (_, w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                aria-pressed={week % sol.weeks === w}
                className={clsx(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  week % sol.weeks === w ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {t("result.week", { w: w + 1 })}
              </button>
            ))}
          </div>
        )}

        <div className="relative ml-auto">
          <Button variant="primary" onClick={() => setMenu((m) => !m)} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {t("result.download")}
          </Button>
          {menu && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <MenuItem onClick={() => exportSols([sols[0]])} title={t("result.best")} sub={`${t("result.solution")} 1`} />
              <MenuItem onClick={() => exportSols([sol])} title={t("result.current")} sub={`${t("result.solution")} ${idx + 1}`} />
              <MenuItem onClick={() => exportSols(sols)} title={t("result.all")} sub={t("result.allSub", { count: sols.length })} />
            </div>
          )}
        </div>
      </div>

      {exportError && <ErrorBox text={t("error.export")} />}
      <TimetableGrid
        timetable={ws.timetable!}
        renderCell={(_, id) => {
          const items = contents.get(id) ?? [];
          return (
            <div className="flex h-full flex-col gap-1 p-1">
              {items.map((it, i) => (
                <div
                  key={i}
                  className={clsx("flex-1 rounded-lg px-2 py-1 text-xs leading-tight", !it.first && "opacity-80")}
                  style={{ background: it.color, color: textOn(it.color) }}
                  title={`${it.level} · ${it.sport} · ${it.place} · ${it.time}`}
                >
                  <div className="font-semibold">
                    {it.level}
                    {it.groups > 1 && <span className="opacity-75"> ×{it.groups}</span>}
                  </div>
                  <div>{it.sport}</div>
                  <div className="flex items-center gap-1 opacity-80">
                    {it.outdoor && winter.has(seg) && <Snowflake size={10} />} {it.place}
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("result.level")}</th>
                {[1, 2, 3].map((n) => (
                  <th key={n} className="px-4 py-3">{t("result.period", { n })}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usedLevels.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 font-medium">
                    {l.name} <span className="ml-1 text-xs text-slate-400">{t(`mode.${l.mode}`)}</span>
                  </td>
                  {[0, 1, 2].map((i) => {
                    const p = MODE_PERIODS[l.mode][i];
                    const sp = p && ws.sports.find((s) => s.id === sol.plan[l.id][p]);
                    return (
                      <td key={i} className="px-4 py-2.5" title={p ? t(periodKey(p)) : ""}>
                        {sp ? sp.name : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("result.places")}</h3>
          <ul className="space-y-1.5 text-sm">
            {ws.places.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                {p.name}
                {p.outdoor && <span className="text-xs text-slate-400">{t("result.outdoor")}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function MenuItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </button>
  );
}
