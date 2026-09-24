import type { Key } from "./i18n";
import type { Params, TargetType, Workspace } from "../types";

export interface Problem {
  key: Key;
  params: Params;
  target?: string;
  targetType: TargetType;
}

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
  problems: Problem[];
}

export function readiness(ws: Workspace): StepStatus {
  const problems: Problem[] = [];
  const hasTT = !!ws.timetable;
  if (!hasTT) problems.push({ key: "ready.timetable", params: {}, targetType: "timetable" });

  const known = new Map(ws.levels.map((l) => [norm(l.name), l]));
  const ttLevels = timetableLevels(ws);
  const missing = ttLevels.filter((n) => !known.has(norm(n)));
  missing.forEach((n) => problems.push({ key: "ready.missingLevel", params: { level: n }, targetType: "level" }));

  const used = ttLevels.map((n) => known.get(norm(n))).filter((l) => !!l);
  const sports = new Map(ws.sports.map((s) => [s.id, s]));
  const noSport = used.filter((l) => !l.sportIds.some((id) => sports.has(id)));
  noSport.forEach((l) =>
    problems.push({ key: "ready.noSport", params: { level: l.name }, target: l.id, targetType: "level" }),
  );
  const levelsOk = hasTT && ttLevels.length > 0 && missing.length === 0 && noSport.length === 0;

  const usedSports = new Set(used.flatMap((l) => l.sportIds).filter((id) => sports.has(id)));
  const places = new Set(ws.places.map((p) => p.id));
  const noPlace = [...usedSports].map((id) => sports.get(id)!).filter((s) => !s.placeIds.some((p) => places.has(p)));
  noPlace.forEach((s) =>
    problems.push({ key: "ready.noPlace", params: { sport: s.name }, target: s.id, targetType: "sport" }),
  );
  const sportsOk = usedSports.size > 0 && noPlace.length === 0;

  const usedPlaces = new Set([...usedSports].flatMap((id) => sports.get(id)!.placeIds));
  const neverAvail = ws.places.filter(
    (p) => usedPlaces.has(p.id) && !Object.values(p.availability).some((a) => a.length > 0),
  );
  neverAvail.forEach((p) =>
    problems.push({ key: "ready.neverAvailable", params: { place: p.name }, target: p.id, targetType: "place" }),
  );
  const placesOk = usedPlaces.size > 0 && neverAvail.length === 0;

  return { timetable: hasTT, levels: levelsOk, sports: sportsOk, places: placesOk, problems };
}

export const isReady = (s: StepStatus) => s.timetable && s.levels && s.sports && s.places;

const ROUTES: Record<TargetType, string> = { timetable: "/", level: "/classes", sport: "/sports", place: "/lieux" };

/** Lien vers la section à corriger (avec mise en évidence de l'élément). */
export function targetLink(targetType?: TargetType | null, target?: string | null, ws?: Workspace): string {
  const route = ROUTES[targetType ?? "timetable"];
  const known = ws && target && [...ws.levels, ...ws.sports, ...ws.places].some((x) => x.id === target);
  return known ? `${route}?focus=${encodeURIComponent(target)}` : route;
}
