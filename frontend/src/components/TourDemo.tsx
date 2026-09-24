import clsx from "clsx";
import { Check, GraduationCap, Home, Loader2, MapPin, MousePointer2, Send, Upload, Volleyball } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../prefs";

/**
 * Démo animée du parcours : un faux curseur se déplace dans une mini
 * application, change de page et remplit les écrans étape par étape.
 */

type Point = [number, number];
interface Frame {
  cursor: Point;
  click?: boolean;
  page: number;
}

// Positions (en %) : barre latérale à gauche, contenu à droite
const NAV_Y = [22, 38, 54, 70];
const nav = (i: number): Point => [6, NAV_Y[i]];

export const SCENES: Frame[][] = [
  // 1. import de l'emploi du temps
  [
    { cursor: [80, 85], page: 0 },
    { cursor: [55, 50], page: 0 },
    { cursor: [55, 50], click: true, page: 0 },
    { cursor: [70, 75], page: 0 },
    { cursor: [70, 75], page: 0 },
    { cursor: [70, 75], page: 0 },
  ],
  // 2. classes
  [
    { cursor: [55, 50], page: 0 },
    { cursor: nav(1), page: 0 },
    { cursor: nav(1), click: true, page: 1 },
    { cursor: [36, 33], click: true, page: 1 },
    { cursor: [36, 60], click: true, page: 1 },
    { cursor: [36, 60], page: 1 },
    { cursor: [36, 60], page: 1 },
  ],
  // 3. sports
  [
    { cursor: [36, 60], page: 1 },
    { cursor: nav(2), page: 1 },
    { cursor: nav(2), click: true, page: 2 },
    { cursor: [44, 33], click: true, page: 2 },
    { cursor: [36, 62], click: true, page: 2 },
    { cursor: [36, 62], page: 2 },
  ],
  // 4. lieux
  [
    { cursor: [36, 62], page: 2 },
    { cursor: nav(3), page: 2 },
    { cursor: nav(3), click: true, page: 3 },
    { cursor: [30, 45], click: true, page: 3 },
    { cursor: [50, 60], click: true, page: 3 },
    { cursor: [70, 75], click: true, page: 3 },
    { cursor: [70, 75], page: 3 },
  ],
  // 5. génération
  [
    { cursor: [70, 75], page: 3 },
    { cursor: nav(0), page: 3 },
    { cursor: nav(0), click: true, page: 0 },
    { cursor: [55, 88], click: true, page: 0 },
    { cursor: [80, 95], page: 0 },
    { cursor: [80, 95], page: 0 },
    { cursor: [80, 95], page: 0 },
  ],
];

export const FRAME_MS = 750;

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899"];
const LEVELS = ["6e", "5e", "4e", "3e"];

function Grid({ fill }: { fill: (i: number) => ReactNode }) {
  return (
    <div className="grid flex-1 grid-cols-5 gap-1">
      {Array.from({ length: 15 }, (_, i) => (
        <div key={i} className="flex min-h-5 items-center justify-center rounded bg-slate-100 text-[8px] font-semibold">
          {fill(i)}
        </div>
      ))}
    </div>
  );
}

function Scene({ scene, f }: { scene: number; f: number }) {
  const t = useT();
  const page = SCENES[scene][f].page;
  if (page === 1)
    return (
      <div className="flex flex-1 gap-2">
        {LEVELS.slice(0, 2).map((l, i) => (
          <div key={l} className="flex flex-1 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
            <div className="text-xs font-bold">{l}</div>
            <div className="flex rounded bg-slate-100 p-0.5 text-[8px]">
              <span className={clsx("flex-1 rounded text-center", !(i === 0 && f >= 3) && "bg-white shadow-sm")}>{t("mode.trimestre")}</span>
              <span className={clsx("flex-1 rounded text-center", i === 0 && f >= 3 && "bg-white text-indigo-600 shadow-sm")}>{t("mode.semestre")}</span>
            </div>
            {["Badminton", "Natation", "Danse"].slice(0, i === 0 ? Math.max(0, f - 3) : 2).map((s) => (
              <div key={s} className="animate-[pop_.3s_ease-out] rounded bg-slate-100 px-1.5 py-1 text-[8px]">{s}</div>
            ))}
          </div>
        ))}
      </div>
    );
  if (page === 2)
    return (
      <div className="flex flex-1 gap-2">
        {["Natation", "Badminton"].map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
            <div className="text-xs font-bold">{s}</div>
            <div className="flex items-center justify-between text-[8px]">
              {t("sports.priority")}
              <span className={clsx("flex h-3 w-3 items-center justify-center rounded-sm border", i === 0 && f >= 3 ? "border-indigo-600 bg-indigo-600 text-on" : "border-slate-300")}>
                {i === 0 && f >= 3 && <Check size={8} strokeWidth={4} />}
              </span>
            </div>
            {(i === 1 || f >= 4) && (
              <div className="flex animate-[pop_.3s_ease-out] items-center gap-1 rounded bg-slate-100 px-1.5 py-1 text-[8px]">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                {i === 0 ? t("demo.pool") : t("places.firstName")}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  if (page === 3)
    return (
      <div className="flex flex-1 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[0] }} /> {t("places.firstName")}
        </div>
        <Grid fill={(i) => (i < (f - 2) * 5 ? <span className="h-full w-full rounded" style={{ background: COLORS[0] }} /> : null)} />
      </div>
    );
  // page 0 : planning
  const imported = scene > 0 || f >= 3;
  const generating = scene === 4 && f === 4;
  const generated = scene === 4 && f >= 5;
  return (
    <div className="flex flex-1 flex-col gap-2">
      {!imported ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-300">
          <span className={clsx("flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-semibold text-slate-50", f === 2 && "scale-95")}>
            <Upload size={12} /> {t("planning.import")}
          </span>
        </div>
      ) : (
        <div className="relative flex flex-1">
          <Grid
            fill={(i) =>
              generated ? (
                <span className="flex h-full w-full items-center justify-center rounded text-on" style={{ background: COLORS[i % 4] }}>
                  {LEVELS[i % 4]}
                </span>
              ) : (i === 7 || i === 12) && (scene > 0 || f >= 4) ? (
                <span className="closed-slot h-full w-full rounded" />
              ) : null
            }
          />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={28} />
            </div>
          )}
        </div>
      )}
      {scene === 4 && (
        <div className="flex justify-center">
          <span className={clsx("flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-[9px] font-semibold text-on", f === 3 && "scale-95")}>
            <Send size={10} /> {t("planning.generate")}
          </span>
        </div>
      )}
    </div>
  );
}

export function TourDemo({ scene, onSceneEnd }: { scene: number; onSceneEnd: () => void }) {
  const [f, setF] = useState(0);
  useEffect(() => setF(0), [scene]);
  const frames = SCENES[scene];
  const frame = frames[Math.min(f, frames.length - 1)];

  useEffect(() => {
    const id = setTimeout(() => (f >= frames.length - 1 ? onSceneEnd() : setF(f + 1)), FRAME_MS);
    return () => clearTimeout(id);
  }, [f, frames.length, onSceneEnd]);

  const icons = [<Home key="h" size={12} />, <GraduationCap key="g" size={12} />, <Volleyball key="v" size={12} />, <MapPin key="m" size={12} />];

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner" data-testid="tour-demo" data-frame={f}>
      <div className="flex h-5 items-center gap-1 border-b border-slate-200 bg-white px-2">
        {["#f87171", "#fbbf24", "#34d399"].map((c) => (
          <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="flex h-[calc(100%-1.25rem)]">
        <div className="relative w-[12%] bg-side">
          {icons.map((icon, i) => (
            <span
              key={i}
              className={clsx(
                "absolute left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md transition",
                frame.page === i ? "bg-indigo-600 text-on" : "text-side-text",
              )}
              style={{ top: `${((NAV_Y[i] - 4) / 96) * 100}%` }}
            >
              {icon}
            </span>
          ))}
        </div>
        <div key={frame.page} className="flex flex-1 animate-[fadein_.35s_ease-out] p-3">
          <Scene scene={scene} f={Math.min(f, frames.length - 1)} />
        </div>
      </div>
      <span
        className="pointer-events-none absolute z-10 transition-all duration-500 ease-out"
        style={{ left: `${frame.cursor[0]}%`, top: `${frame.cursor[1]}%` }}
      >
        {frame.click && <span className="absolute -left-2 -top-2 h-5 w-5 animate-ping rounded-full bg-indigo-500/40" />}
        <MousePointer2 size={18} className="fill-slate-900 text-on drop-shadow" />
      </span>
    </div>
  );
}
