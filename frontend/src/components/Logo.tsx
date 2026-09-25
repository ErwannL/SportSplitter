import clsx from "clsx";
import { useId } from "react";

/**
 * Le logo de SportSplitter : un ballon découpé en trois tranches décalées.
 * Le ballon, c'est le sport ; les trois tranches, ce que fait l'application —
 * répartir les classes entre les sports, les lieux et les créneaux, en colonnes
 * comme la grille d'emploi du temps.
 *
 * `mode` :
 *   - `static` : immobile ;
 *   - `hover`  : les tranches ondulent au survol (du logo, ou d'un parent `.group`) ;
 *   - `loop`   : ondulation continue — c'est l'indicateur de chargement de toute
 *                l'application (voir `LogoLoader`), à la place d'une roue.
 * L'animation est coupée sous `prefers-reduced-motion` (index.css).
 *
 * Le même dessin existe en fichier : `public/favicon.svg` (statique) et
 * `public/logo-animated.svg` (animé), repris par Orqea pour sa tuile.
 */
export type LogoMode = "static" | "hover" | "loop";

/** x de chaque colonne, décalage au repos et au sommet de la vague (px, viewBox 64). */
export const SLICES = [
  { x: 15, rest: -3, peak: 4, delay: "0s" },
  { x: 27, rest: 0, peak: -4, delay: "0.12s" },
  { x: 39, rest: 3, peak: -4, delay: "0.24s" },
] as const;

export function Logo({ size = 36, mode = "static", className, title }: { size?: number; mode?: LogoMode; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={clsx("ss-logo", `ss-logo--${mode}`, className)}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        {SLICES.map((s, i) => (
          <clipPath key={s.x} id={`${id}-c${i}`}>
            <rect x={s.x} y="0" width="10" height="64" />
          </clipPath>
        ))}
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      {SLICES.map((s, i) => (
        <g
          key={s.x}
          className="ss-slice"
          style={{ ["--ss-rest" as string]: `${s.rest}px`, ["--ss-peak" as string]: `${s.peak}px`, animationDelay: s.delay }}
        >
          <g clipPath={`url(#${id}-c${i})`}>
            <circle cx="32" cy="32" r="17" fill="#fff" />
            <path d="M14 27.5 Q32 37 50 27.5" fill="none" stroke="#4f46e5" strokeOpacity="0.45" strokeWidth="2.2" />
            <path d="M14 38.5 Q32 30 50 38.5" fill="none" stroke="#7c3aed" strokeOpacity="0.3" strokeWidth="2.2" />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** L'indicateur de chargement de l'application : le logo qui ondule. */
export function LogoLoader({ size = 40, className, label }: { size?: number; className?: string; label?: string }) {
  return <Logo size={size} mode="loop" className={clsx("shrink-0", className)} title={label} />;
}
