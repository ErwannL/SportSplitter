import clsx from "clsx";
import type { ReactNode } from "react";
import { slotId } from "../lib/readiness";
import { useT } from "../prefs";
import type { Cell, Timetable } from "../types";

interface Props {
  timetable: Timetable;
  renderCell: (cell: Cell, id: string) => ReactNode;
  cellClassName?: (cell: Cell, id: string) => string | undefined;
  onCellPointerDown?: (cell: Cell, id: string) => void;
  onCellPointerEnter?: (cell: Cell, id: string) => void;
  compact?: boolean;
  dim?: boolean;
}

/** Grille hebdomadaire générique (heures × jours) avec cellules fusionnées. */
export function TimetableGrid({ timetable, renderCell, cellClassName, onCellPointerDown, onCellPointerEnter, compact, dim }: Props) {
  const t = useT();
  const rowH = compact ? "minmax(2.75rem, auto)" : "minmax(5rem, auto)";
  return (
    <div
      className={clsx("grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 text-sm select-none", dim && "opacity-40")}
      style={{
        gridTemplateColumns: `${compact ? "3.5rem" : "5.5rem"} repeat(${timetable.days.length}, minmax(0, 1fr))`,
        gridTemplateRows: `auto repeat(${timetable.rows.length}, ${rowH})`,
        gap: 1,
      }}
    >
      <div className="bg-slate-50 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{compact ? "" : t("planning.hours")}</div>
      {timetable.days.map((d) => (
        <div key={d} className="truncate bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
          {compact ? d.slice(0, 3) : d}
        </div>
      ))}
      {timetable.rows.map((r, i) => (
        <div key={i} style={{ gridRow: i + 2, gridColumn: 1 }} className="flex flex-col justify-between bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{r.start || r.label}</span>
          {!compact && r.end && <span>{r.end}</span>}
        </div>
      ))}
      {timetable.cells.map((c) => {
        const id = slotId(c.day, c.row);
        return (
          <div
            key={id}
            style={{ gridRow: `${c.row + 2} / span ${c.rowSpan}`, gridColumn: c.day + 2 }}
            className={clsx(
              "relative min-w-0",
              c.closed ? "closed-slot" : "bg-white",
              cellClassName?.(c, id),
            )}
            onPointerDown={onCellPointerDown && !c.closed ? () => onCellPointerDown(c, id) : undefined}
            onPointerEnter={onCellPointerEnter && !c.closed ? () => onCellPointerEnter(c, id) : undefined}
          >
            {renderCell(c, id)}
          </div>
        );
      })}
    </div>
  );
}
