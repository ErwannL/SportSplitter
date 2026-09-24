export type Segment = "Q1" | "Q2" | "Q3" | "Q4";
export type Mode = "trimestre" | "semestre";
export type Period = "T1" | "T2" | "T3" | "S1" | "S2";

export interface TimeRow {
  label: string;
  start: string;
  end: string;
  minutes: number;
}

export interface Entry {
  level: string;
  groups: number;
}

export interface Cell {
  day: number;
  row: number;
  rowSpan: number;
  closed: boolean;
  entries: Entry[];
}

export interface Timetable {
  days: string[];
  rows: TimeRow[];
  cells: Cell[];
  fileName: string;
}

export interface Level {
  id: string;
  name: string;
  mode: Mode;
  sportIds: string[];
  /** classes du niveau qui ont EPS en même temps */
  groups: number;
  /** rythme : une liste par semaine du cycle (1 à 4), durées des séances en minutes */
  cycle: number[][];
}

export interface Sport {
  id: string;
  name: string;
  priority: boolean;
  barrette: boolean;
  placeIds: string[];
}

export interface Place {
  id: string;
  name: string;
  color: string;
  outdoor: boolean;
  capacity: number;
  availability: Record<string, Segment[]>;
}

export interface Settings {
  winterSegments: Segment[];
  winterRule: "soft" | "hard" | "off";
  maxWinterViolations: number;
  priorityRequired: boolean;
  barretteMinGroups: number;
  allowRepeat: boolean;
  sameDayAllowed: boolean;
  separatePlacesRule: "soft" | "hard" | "off";
  maxSeparateViolations: number;
  maxSolutions: number;
  timeLimit: number;
}

export type Params = Record<string, string | number>;
export type TargetType = "level" | "sport" | "place" | "timetable";

export interface Me {
  role: string;
  permissions: string[];
}

export interface Preferences {
  fillVertical: "top" | "bottom" | "none";
  fillHorizontal: "left" | "right" | "none";
  /** l'établissement a cours le samedi */
  saturday: boolean;
}

export interface Workspace {
  timetable: Timetable | null;
  levels: Level[];
  sports: Sport[];
  places: Place[];
  settings: Settings;
  preferences: Preferences;
}

export interface Placement {
  placeId: string;
  groups: number;
}

export interface Assignment {
  slotId: string;
  levelId: string;
  period: Period;
  sportId: string;
  placements: Placement[];
  session: number;
  week: number;
  day: number;
  row: number;
  span: number;
  minutes: number;
}

export interface Violation {
  rule: string;
  message: string;
  params?: Params;
  levelId?: string | null;
  period?: Period | null;
  placeId?: string | null;
}

export interface Solution {
  index: number;
  plan: Record<string, Partial<Record<Period, string>>>;
  weeks: number;
  fillCost?: number;
  assignments: Assignment[];
  violations: Violation[];
}

export interface Issue {
  severity: "error" | "warning";
  code: string;
  message: string;
  target?: string | null;
  targetType?: TargetType | null;
  params?: Params;
}

export interface SolveResult {
  status: "ok" | "relaxed" | "infeasible";
  solutions: Solution[];
  totalFound: number;
  truncated: boolean;
  issues: Issue[];
}
