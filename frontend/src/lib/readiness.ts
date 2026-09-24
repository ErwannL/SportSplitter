import type { Workspace } from "../types";

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const slotId = (day: number, row: number) => `${day}-${row}`;

/** Noms de niveaux cités dans l'emploi du temps (casse d'origine, sans doublon). */
export function timetableLevels(ws: Workspace): string[] {
  const seen = new Map<string, string>();
  for (const c of ws.timetable?.cells ?? []) {
    if (c.closed) continue;
    for (const e of c.entries) if (!seen.has(norm(e.level))) seen.set(norm(e.level), e.level);
  }
  return [...seen.values()];
}

export interface StepStatus {
  timetable: boolean;
  levels: boolean;
  sports: boolean;
  places: boolean;
  problems: string[];
}

export function readiness(ws: Workspace): StepStatus {
  const problems: string[] = [];
  const hasTT = !!ws.timetable;
  if (!hasTT) problems.push("Importez un emploi du temps.");

  const known = new Map(ws.levels.map((l) => [norm(l.name), l]));
  const ttLevels = timetableLevels(ws);
  const missing = ttLevels.filter((n) => !known.has(norm(n)));
  missing.forEach((n) => problems.push(`Le niveau « ${n} » n'est pas configuré.`));

  const used = ttLevels.map((n) => known.get(norm(n))).filter((l) => !!l);
  const sports = new Map(ws.sports.map((s) => [s.id, s]));
  const noSport = used.filter((l) => !l.sportIds.some((id) => sports.has(id)));
  noSport.forEach((l) => problems.push(`Le niveau « ${l.name} » n'a aucun sport.`));
  const levelsOk = hasTT && ttLevels.length > 0 && missing.length === 0 && noSport.length === 0;

  const usedSports = new Set(used.flatMap((l) => l.sportIds).filter((id) => sports.has(id)));
  const places = new Set(ws.places.map((p) => p.id));
  const noPlace = [...usedSports].map((id) => sports.get(id)!).filter((s) => !s.placeIds.some((p) => places.has(p)));
  noPlace.forEach((s) => problems.push(`Le sport « ${s.name} » n'a aucun lieu.`));
  const sportsOk = usedSports.size > 0 && noPlace.length === 0;

  const usedPlaces = new Set([...usedSports].flatMap((id) => sports.get(id)!.placeIds));
  const neverAvail = ws.places.filter(
    (p) => usedPlaces.has(p.id) && !Object.values(p.availability).some((a) => a.length > 0),
  );
  neverAvail.forEach((p) => problems.push(`Le lieu « ${p.name} » n'a aucune disponibilité.`));
  const placesOk = usedPlaces.size > 0 && neverAvail.length === 0;

  return { timetable: hasTT, levels: levelsOk, sports: sportsOk, places: placesOk, problems };
}

export const isReady = (s: StepStatus) => s.timetable && s.levels && s.sports && s.places;
