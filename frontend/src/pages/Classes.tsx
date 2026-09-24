import { AlertTriangle, GraduationCap, Sparkles } from "lucide-react";
import { MODE_PERIODS } from "../lib/periods";
import { norm, timetableLevels } from "../lib/readiness";
import { LEVEL_PRESETS, missingLevels, useStore } from "../store";
import { AddColumn, AddPicker, Board, Button, Chip, Column, EmptyState, PageHeader, SectionLabel, Segmented } from "../components/ui";
import type { Mode } from "../types";

export function ClassesPage() {
  const s = useStore();
  const { ws } = s;
  const missing = missingLevels(ws);
  const used = new Set(timetableLevels(ws).map(norm));

  return (
    <>
      <PageHeader
        step={2}
        title="Classes"
        subtitle="Créez vos niveaux (nommez-les comme dans l'emploi du temps), choisissez un fonctionnement par trimestre ou semestre et attribuez les sports."
        actions={Object.entries(LEVEL_PRESETS).map(([k, names]) => (
          <Button key={k} size="sm" onClick={() => s.addLevels(names)}>
            + {k}
          </Button>
        ))}
      />

      {missing.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} />
          <span className="flex-1">
            Niveaux présents dans l'emploi du temps mais pas configurés : <b>{missing.join(", ")}</b>
          </span>
          <Button size="sm" variant="primary" onClick={() => s.addLevels(missing)}>
            <Sparkles size={14} /> Les créer
          </Button>
        </div>
      )}

      {ws.levels.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title="Aucun niveau"
          text="Ajoutez un niveau, ou utilisez un préréglage (Collège, Lycée…). Vous pouvez donner le nom que vous voulez."
          action={<Button variant="primary" onClick={() => s.addLevel()}>Ajouter un niveau</Button>}
        />
      ) : (
        <Board>
          {ws.levels.map((lv) => {
            const periods = MODE_PERIODS[lv.mode].length;
            return (
              <Column
                key={lv.id}
                title={lv.name}
                onRename={(name) => s.updateLevel(lv.id, { name })}
                onDelete={() => s.removeLevel(lv.id)}
                badge={
                  !used.has(norm(lv.name)) && ws.timetable ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title="Absent de l'emploi du temps">
                      inutilisé
                    </span>
                  ) : undefined
                }
              >
                <Segmented<Mode>
                  value={lv.mode}
                  onChange={(mode) => s.updateLevel(lv.id, { mode })}
                  options={[
                    { value: "trimestre", label: "Trimestre" },
                    { value: "semestre", label: "Semestre" },
                  ]}
                />
                <div className="flex items-center justify-between">
                  <SectionLabel>Sports</SectionLabel>
                  <span className="text-xs text-slate-400">
                    {lv.sportIds.length} / {periods} périodes
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {lv.sportIds.map((id) => {
                    const sp = ws.sports.find((x) => x.id === id);
                    if (!sp) return null;
                    return (
                      <Chip
                        key={id}
                        label={sp.name}
                        sub={sp.priority ? <span className="rounded bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700">PRIO</span> : undefined}
                        onRemove={() => s.updateLevel(lv.id, { sportIds: lv.sportIds.filter((x) => x !== id) })}
                      />
                    );
                  })}
                  <AddPicker
                    placeholder="Badminton, Natation…"
                    options={ws.sports}
                    exclude={lv.sportIds}
                    onPick={(id) => s.updateLevel(lv.id, { sportIds: [...lv.sportIds, id] })}
                    onCreate={(name) => {
                      const id = s.addSport(name);
                      const cur = useStore.getState().ws.levels.find((l) => l.id === lv.id)!;
                      s.updateLevel(lv.id, { sportIds: [...cur.sportIds, id] });
                    }}
                  />
                </div>
                {lv.sportIds.length > 0 && lv.sportIds.length < periods && (
                  <p className="px-1 text-xs text-slate-400">Moins de sports que de périodes : certains seront répétés.</p>
                )}
              </Column>
            );
          })}
          <AddColumn label="Ajouter un niveau" onAdd={() => s.addLevel()} />
        </Board>
      )}
    </>
  );
}
