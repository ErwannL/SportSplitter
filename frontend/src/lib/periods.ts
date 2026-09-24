import type { Mode, Period, Segment } from "../types";

export const SEGMENTS: Segment[] = ["Q1", "Q2", "Q3", "Q4"];

export const SEGMENT_LABELS: Record<Segment, string> = {
  Q1: "Sept – Nov",
  Q2: "Déc – Janv",
  Q3: "Févr – Mars",
  Q4: "Avr – Juin",
};

export const SEGMENT_HINT: Record<Segment, string> = {
  Q1: "T1 · S1",
  Q2: "T2 · S1",
  Q3: "T2 · S2",
  Q4: "T3 · S2",
};

export const PERIODS: Record<Period, Segment[]> = {
  T1: ["Q1"],
  T2: ["Q2", "Q3"],
  T3: ["Q4"],
  S1: ["Q1", "Q2"],
  S2: ["Q3", "Q4"],
};

export const MODE_PERIODS: Record<Mode, Period[]> = {
  trimestre: ["T1", "T2", "T3"],
  semestre: ["S1", "S2"],
};

export const PERIOD_LABELS: Record<Period, string> = {
  T1: "1er trimestre",
  T2: "2e trimestre",
  T3: "3e trimestre",
  S1: "1er semestre",
  S2: "2e semestre",
};

export type Brush = "all" | Period | "erase";

export const BRUSHES: { id: Brush; label: string }[] = [
  { id: "all", label: "Toute l'année" },
  { id: "T1", label: "T1" },
  { id: "T2", label: "T2" },
  { id: "T3", label: "T3" },
  { id: "S1", label: "S1" },
  { id: "S2", label: "S2" },
  { id: "erase", label: "Effacer" },
];

/** Applique un pinceau à la liste des segments disponibles d'un créneau. */
export function applyBrush(current: Segment[], brush: Brush): Segment[] {
  if (brush === "erase") return [];
  const add = brush === "all" ? SEGMENTS : PERIODS[brush];
  const set = new Set([...current, ...add]);
  return SEGMENTS.filter((s) => set.has(s));
}

/** Retire les segments d'un pinceau (clic sur une case déjà remplie). */
export function removeBrush(current: Segment[], brush: Brush): Segment[] {
  if (brush === "erase" || brush === "all") return [];
  const remove = new Set(PERIODS[brush]);
  return current.filter((s) => !remove.has(s));
}

export function brushCovered(current: Segment[], brush: Brush): boolean {
  if (brush === "erase") return current.length === 0;
  const need = brush === "all" ? SEGMENTS : PERIODS[brush];
  return need.every((s) => current.includes(s));
}
