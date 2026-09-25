/**
 * Couleurs des lieux : une couleur par défaut stable (dérivée du nom et de
 * l'identifiant), vive, jamais trop proche du noir ou du blanc, et la plus
 * éloignée possible des couleurs déjà utilisées.
 */

export type RGB = [number, number, number];

/** Hachage FNV-1a 32 bits. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Distance perceptuelle approchée (« redmean »), de 0 à ~765. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texte lisible (sombre ou blanc) sur une couleur de fond. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.4 ? "#0f172a" : "#ffffff";
}

export const TOO_CLOSE = 110;

export function isTooClose(color: string, others: string[]): boolean {
  return others.some((o) => colorDistance(color, o) < TOO_CLOSE);
}

const GOLDEN_ANGLE = 137.508;
export const MIN_LUMINANCE = 0.12;
export const MAX_LUMINANCE = 0.55;

/** Couleur HSL dont la luminosité est corrigée pour rester loin du noir et du blanc. */
export function balanced(h: number, s: number, l: number): string {
  let light = l;
  let c = hslToHex(h, s, light);
  while (luminance(c) < MIN_LUMINANCE && light < 80) c = hslToHex(h, s, (light += 2));
  while (luminance(c) > MAX_LUMINANCE && light > 20) c = hslToHex(h, s, (light -= 2));
  return c;
}

/** Couleur par défaut d'un lieu, distincte des couleurs existantes. */
export function placeColor(name: string, id: string, existing: string[]): string {
  const seed = hash(`${name.trim().toLowerCase()}|${id}`);
  const base = seed % 360;
  const sat = 62 + (seed % 14); // 62–75 %
  const light = 46 + ((seed >> 8) % 12); // 46–57 % : ni trop sombre ni trop clair
  let best = balanced(base, sat, light);
  let bestScore = -1;
  for (let k = 0; k < 36; k++) {
    const c = balanced((base + k * GOLDEN_ANGLE) % 360, sat, light);
    const score = existing.length ? Math.min(...existing.map((e) => colorDistance(c, e))) : Infinity;
    if (score >= TOO_CLOSE * 1.6) return c;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

/** Palette proposée dans le sélecteur. */
export const SWATCHES = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16",
  "#0891b2", "#be185d",
];
