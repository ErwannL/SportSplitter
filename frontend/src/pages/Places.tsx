import clsx from "clsx";
import { CalendarX2, Eraser, MapPin, Minus, PaintBucket, Plus, Snowflake } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TimetableGrid } from "../components/TimetableGrid";
import { AddColumn, Board, Button, Checkbox, Column, EmptyState, IconButton, PageHeader, SectionLabel } from "../components/ui";
import { applyBrush, brushCovered, BRUSHES, removeBrush, SEGMENT_HINT, SEGMENT_LABELS, SEGMENTS, type Brush } from "../lib/periods";
import { slotId } from "../lib/readiness";
import { PLACE_COLORS, useStore } from "../store";
import type { Place, Segment } from "../types";

export function PlacesPage() {
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

  const apply = (place: Place, id: string, add: boolean) => {
    const cur = useStore.getState().ws.places.find((p) => p.id === place.id)!;
    const now = cur.availability[id] ?? [];
    const next = add ? applyBrush(now, brush) : removeBrush(now, brush);
    s.updatePlace(place.id, { availability: { ...cur.availability, [id]: next } });
  };

  const fillAll = (place: Place, segs: Segment[]) => {
    const availability: Record<string, Segment[]> = {};
    for (const c of ws.timetable?.cells ?? []) if (!c.closed) availability[slotId(c.day, c.row)] = segs;
    s.updatePlace(place.id, { availability });
  };

  const winter = new Set(ws.settings.winterSegments);

  return (
    <>
      <PageHeader
        step={4}
        title="Lieux"
        subtitle="Donnez une couleur à chaque lieu et peignez ses disponibilités dans la grille : choisissez une période puis cliquez ou glissez sur les créneaux."
      />

      {!ws.timetable ? (
        <EmptyState
          icon={<CalendarX2 />}
          title="Importez d'abord l'emploi du temps"
          text="La grille des disponibilités reprend les créneaux de votre emploi du temps."
          action={<Button variant="primary" onClick={() => nav("/")}>Importer</Button>}
        />
      ) : ws.places.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title="Aucun lieu"
          text="Ajoutez des lieux ici ou depuis la page Sports."
          action={<Button variant="primary" onClick={() => s.addPlace("Gymnase")}>Ajouter un lieu</Button>}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-2 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <PaintBucket size={16} /> Pinceau
            </span>
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {BRUSHES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrush(b.id)}
                  className={clsx(
                    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    brush === b.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {b.id === "erase" && <Eraser size={14} />}
                  {b.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              {SEGMENTS.map((seg) => (
                <span key={seg} className="flex items-center gap-1" title={SEGMENT_HINT[seg]}>
                  {winter.has(seg) && <Snowflake size={12} className="text-sky-500" />}
                  <b className="text-slate-700">{SEGMENTS.indexOf(seg) + 1}</b> {SEGMENT_LABELS[seg]}
                </span>
              ))}
            </div>
          </div>

          <Board>
            {ws.places.map((pl) => (
              <Column
                key={pl.id}
                title={pl.name}
                accent={pl.color}
                width="w-[26rem]"
                onRename={(name) => s.updatePlace(pl.id, { name })}
                onDelete={() => s.removePlace(pl.id)}
              >
                <div className="flex items-center gap-3">
                  <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full ring-2 ring-white shadow" style={{ background: pl.color }} title="Couleur personnalisée">
                    <input type="color" value={pl.color} onChange={(e) => s.updatePlace(pl.id, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PLACE_COLORS.map((c) => (
                      <button
                        key={c}
                        aria-label={c}
                        onClick={() => s.updatePlace(pl.id, { color: c })}
                        className={clsx("h-5 w-5 rounded-full transition hover:scale-110", c === pl.color && "ring-2 ring-slate-900 ring-offset-1")}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="-mx-1 grid grid-cols-2 divide-x divide-slate-100 rounded-xl border border-slate-100">
                  <Checkbox label="Extérieur" hint="Évité en hiver" checked={pl.outdoor} onChange={(outdoor) => s.updatePlace(pl.id, { outdoor })} />
                  <div className="flex items-center justify-between px-3" title="Nombre de classes accueillies en même temps">
                    <span className="text-sm text-slate-700">Classes</span>
                    <div className="flex items-center gap-1">
                      <IconButton label="Moins" onClick={() => s.updatePlace(pl.id, { capacity: Math.max(1, pl.capacity - 1) })}><Minus size={14} /></IconButton>
                      <span className="w-4 text-center text-sm font-semibold">{pl.capacity}</span>
                      <IconButton label="Plus" onClick={() => s.updatePlace(pl.id, { capacity: pl.capacity + 1 })}><Plus size={14} /></IconButton>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <SectionLabel>Disponibilités</SectionLabel>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => fillAll(pl, [...SEGMENTS])}>Tout</Button>
                    <Button size="sm" variant="ghost" onClick={() => fillAll(pl, [])}>Vider</Button>
                  </div>
                </div>
                <div className="touch-none">
                  <TimetableGrid
                    compact
                    timetable={ws.timetable!}
                    cellClassName={() => "cursor-crosshair hover:brightness-95"}
                    onCellPointerDown={(_, id) => {
                      const add = !brushCovered(pl.availability[id] ?? [], brush) || brush === "erase";
                      paint.current = { placeId: pl.id, add };
                      apply(pl, id, add);
                    }}
                    onCellPointerEnter={(_, id) => {
                      if (paint.current?.placeId === pl.id) apply(pl, id, paint.current.add);
                    }}
                    renderCell={(c, id) => {
                      if (c.closed) return null;
                      const segs = pl.availability[id] ?? [];
                      return (
                        <div className="absolute inset-0 flex gap-px p-0.5">
                          {SEGMENTS.map((seg) => (
                            <div
                              key={seg}
                              className="flex-1 rounded-sm transition"
                              style={{ background: segs.includes(seg) ? pl.color : "#f1f5f9" }}
                              title={`${SEGMENT_LABELS[seg]} (${SEGMENT_HINT[seg]})`}
                            />
                          ))}
                        </div>
                      );
                    }}
                  />
                </div>
              </Column>
            ))}
            <AddColumn label="Ajouter un lieu" onAdd={() => s.addPlace(`Lieu ${ws.places.length + 1}`)} />
          </Board>
        </>
      )}
    </>
  );
}
