import clsx from "clsx";
import { AlertTriangle, CalendarX2, Eraser, MapPin, Minus, PaintBucket, Plus, Snowflake, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TimetableGrid } from "../components/TimetableGrid";
import { AddColumn, Board, Button, Checkbox, Column, EmptyState, IconButton, PageHeader, SectionLabel } from "../components/ui";
import { colorDistance, isTooClose, placeColor, SWATCHES, TOO_CLOSE } from "../lib/colors";
import { segmentKey, type Key } from "../lib/i18n";
import { applyBrush, brushCovered, BRUSHES, removeBrush, SEGMENT_HINT, SEGMENTS, type Brush } from "../lib/periods";
import { slotId } from "../lib/readiness";
import { useT } from "../prefs";
import { useStore } from "../store";
import type { Place, Segment } from "../types";

const brushLabel = (b: Brush): Key | null => (b === "all" ? "brush.all" : b === "erase" ? "brush.erase" : null);

export function PlacesPage() {
  const t = useT();
  const s = useStore();
  const { ws } = s;
  const nav = useNavigate();
  const [brush, setBrush] = useState<Brush>("all");
  const paint = useRef<{ placeId: string; add: boolean } | null>(null);

  useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const apply = (placeId: string, id: string, add: boolean) => {
    const cur = useStore.getState().ws.places.find((p) => p.id === placeId)!;
    const now = cur.availability[id] ?? [];
    const next = add ? applyBrush(now, brush) : removeBrush(now, brush);
    s.updatePlace(placeId, { availability: { ...cur.availability, [id]: next } });
  };

  const fillAll = (place: Place, segs: Segment[]) => {
    const availability: Record<string, Segment[]> = {};
    for (const c of ws.timetable!.cells) if (!c.closed) availability[slotId(c.day, c.row)] = segs;
    s.updatePlace(place.id, { availability });
  };

  const winter = new Set(ws.settings.winterSegments);

  if (!ws.timetable)
    return (
      <>
        <PageHeader step={4} title={t("places.title")} subtitle={t("places.subtitle")} />
        <EmptyState
          icon={<CalendarX2 />}
          title={t("places.needTimetable")}
          text={t("places.needTimetableText")}
          action={<Button variant="primary" onClick={() => nav("/")}>{t("places.import")}</Button>}
        />
      </>
    );

  return (
    <>
      <PageHeader step={4} title={t("places.title")} subtitle={t("places.subtitle")} />
      {ws.places.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title={t("places.empty")}
          text={t("places.emptyText")}
          action={<Button variant="primary" onClick={() => s.addPlace(t("places.firstName"))}>{t("places.add")}</Button>}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <PaintBucket size={16} /> {t("places.brush")}
            </span>
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label={t("places.brush")}>
              {BRUSHES.map((b) => {
                const key = brushLabel(b);
                return (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={brush === b}
                    onClick={() => setBrush(b)}
                    className={clsx(
                      "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                      brush === b ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {b === "erase" && <Eraser size={14} />}
                    {key ? t(key) : b}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {SEGMENTS.map((seg, i) => (
                <span key={seg} className="flex items-center gap-1" title={SEGMENT_HINT[seg]}>
                  {winter.has(seg) && <Snowflake size={12} className="text-sky-500" />}
                  <b className="text-slate-700">{i + 1}</b> {t(segmentKey(seg))}
                </span>
              ))}
            </div>
          </div>

          <Board>
            {ws.places.map((pl) => {
              const others = ws.places.filter((o) => o.id !== pl.id);
              const clash = others.find((o) => colorDistance(o.color, pl.color) < TOO_CLOSE);
              return (
                <Column
                  key={pl.id}
                  id={pl.id}
                  title={pl.name}
                  accent={pl.color}
                  width="w-[26rem]"
                  onRename={(name) => s.updatePlace(pl.id, { name })}
                  onDelete={() => s.removePlace(pl.id)}
                >
                  <div className="flex items-center gap-3">
                    <label
                      className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full shadow ring-2 ring-white"
                      style={{ background: pl.color }}
                      title={t("places.custom")}
                    >
                      <input
                        type="color"
                        aria-label={t("places.custom")}
                        value={pl.color}
                        onChange={(e) => s.updatePlace(pl.id, { color: e.target.value })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {SWATCHES.map((c) => {
                        const taken = isTooClose(c, others.map((o) => o.color));
                        return (
                          <button
                            key={c}
                            aria-label={c}
                            disabled={taken}
                            title={taken ? t("places.taken") : c}
                            onClick={() => s.updatePlace(pl.id, { color: c })}
                            className={clsx(
                              "h-5 w-5 rounded-full transition enabled:hover:scale-110 disabled:cursor-not-allowed disabled:opacity-20",
                              c === pl.color && "ring-2 ring-slate-900 ring-offset-1 ring-offset-white",
                            )}
                            style={{ background: c }}
                          />
                        );
                      })}
                      <IconButton
                        label={t("places.autoColor")}
                        className="h-5 w-5"
                        onClick={() => s.updatePlace(pl.id, { color: placeColor(pl.name, pl.id, others.map((o) => o.color)) })}
                      >
                        <Wand2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                  {clash && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                      <AlertTriangle size={14} /> {t("places.similar", { name: clash.name })}
                    </div>
                  )}
                  <div className="-mx-1 grid grid-cols-2 divide-x divide-slate-100 rounded-xl border border-slate-100">
                    <Checkbox label={t("places.outdoor")} hint={t("places.outdoorHint")} checked={pl.outdoor} onChange={(outdoor) => s.updatePlace(pl.id, { outdoor })} />
                    <div className="flex items-center justify-between px-3" title={t("places.capacityHint")}>
                      <span className="text-sm text-slate-700">{t("places.capacity")}</span>
                      <div className="flex items-center gap-1">
                        <IconButton label={t("common.less")} onClick={() => s.updatePlace(pl.id, { capacity: Math.max(1, pl.capacity - 1) })}>
                          <Minus size={14} />
                        </IconButton>
                        <span className="w-4 text-center text-sm font-semibold">{pl.capacity}</span>
                        <IconButton label={t("common.more")} onClick={() => s.updatePlace(pl.id, { capacity: pl.capacity + 1 })}>
                          <Plus size={14} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>{t("places.availability")}</SectionLabel>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => fillAll(pl, [...SEGMENTS])}>{t("places.fill")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => fillAll(pl, [])}>{t("places.clear")}</Button>
                    </div>
                  </div>
                  <div className="touch-none">
                    <TimetableGrid
                      compact
                      timetable={ws.timetable!}
                      cellClassName={() => "cursor-crosshair hover:brightness-95"}
                      onCellPointerDown={(_, id) => {
                        const add = brush === "erase" || !brushCovered(pl.availability[id] ?? [], brush);
                        paint.current = { placeId: pl.id, add };
                        apply(pl.id, id, add);
                      }}
                      onCellPointerEnter={(_, id) => {
                        if (paint.current?.placeId === pl.id) apply(pl.id, id, paint.current.add);
                      }}
                      renderCell={(c, id) => {
                        if (c.closed) return null;
                        const segs = pl.availability[id] ?? [];
                        return (
                          <div className="absolute inset-0 flex gap-px p-0.5" data-testid={`avail-${pl.id}-${id}`}>
                            {SEGMENTS.map((seg) => (
                              <div
                                key={seg}
                                className="flex-1 rounded-sm transition"
                                style={{ background: segs.includes(seg) ? pl.color : "var(--color-slate-100)" }}
                                title={`${t(segmentKey(seg))} (${SEGMENT_HINT[seg]})`}
                              />
                            ))}
                          </div>
                        );
                      }}
                    />
                  </div>
                </Column>
              );
            })}
            <AddColumn label={t("places.add")} onAdd={() => s.addPlace(t("places.defaultName", { n: ws.places.length + 1 }))} />
          </Board>
        </>
      )}
    </>
  );
}
