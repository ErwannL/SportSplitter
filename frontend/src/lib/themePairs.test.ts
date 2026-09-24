import { describe, expect, it } from "vitest";

// Le thème sombre INVERSE l'échelle des gris (index.css) : `bg-slate-900` y
// devient presque blanc. Un texte posé dessus doit donc s'inverser avec lui
// (`text-slate-50`), jamais rester blanc (`text-on`) — sinon blanc sur blanc.
// Trouvé sur le bouton « Importer un fichier » de Planning.

const sources = import.meta.glob(["../**/*.tsx", "!../**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("paires de couleurs du thème", () => {
  it("lit bien les sources", () => {
    expect(Object.keys(sources)).toContain("../pages/Planning.tsx");
  });

  it("aucun élément ne combine bg-slate-900 et text-on", () => {
    const offenders = Object.entries(sources).flatMap(([file, code]) =>
      (code.match(/className=["'`{][^\n]*/g) ?? [])
        .filter((line) => /\bbg-slate-900\b/.test(line) && /\btext-on\b/.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
