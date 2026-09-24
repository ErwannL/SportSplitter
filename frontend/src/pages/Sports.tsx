import { Volleyball } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { AddColumn, AddPicker, Board, Button, Checkbox, Chip, Column, EmptyState, PageHeader, SectionLabel } from "../components/ui";

export function SportsPage() {
  const s = useStore();
  const { ws } = s;
  const nav = useNavigate();

  return (
    <>
      <PageHeader
        step={3}
        title="Sports"
        subtitle="Pour chaque sport : prioritaire (placé en premier), barrette (2 classes du même niveau en même temps) et les lieux où il peut se pratiquer."
      />
      {ws.sports.length === 0 ? (
        <EmptyState
          icon={<Volleyball />}
          title="Aucun sport"
          text="Ajoutez des sports depuis la page Classes, ou créez-les ici."
          action={<Button variant="primary" onClick={() => nav("/classes")}>Aller aux classes</Button>}
        />
      ) : (
        <Board>
          {ws.sports.map((sp) => {
            const levels = ws.levels.filter((l) => l.sportIds.includes(sp.id));
            return (
              <Column
                key={sp.id}
                title={sp.name}
                width="w-64"
                accent={sp.priority ? "#4f46e5" : "#cbd5e1"}
                onRename={(name) => s.updateSport(sp.id, { name })}
                onDelete={() => s.removeSport(sp.id)}
              >
                <div className="-mx-1 flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100">
                  <Checkbox label="Prioritaire" hint="Placé en premier par l'algorithme" checked={sp.priority} onChange={(priority) => s.updateSport(sp.id, { priority })} />
                  <Checkbox label="Barrette" hint="Deux classes du même niveau en même temps" checked={sp.barrette} onChange={(barrette) => s.updateSport(sp.id, { barrette })} />
                </div>
                <SectionLabel>Lieux</SectionLabel>
                <div className="flex flex-col gap-2">
                  {sp.placeIds.map((id) => {
                    const pl = ws.places.find((p) => p.id === id);
                    if (!pl) return null;
                    return (
                      <Chip
                        key={id}
                        label={pl.name}
                        color={pl.color}
                        sub={pl.outdoor ? <span className="text-[10px] font-semibold text-emerald-600">EXT</span> : undefined}
                        onRemove={() => s.updateSport(sp.id, { placeIds: sp.placeIds.filter((x) => x !== id) })}
                      />
                    );
                  })}
                  <AddPicker
                    placeholder="Gymnase, Piscine…"
                    options={ws.places}
                    exclude={sp.placeIds}
                    onPick={(id) => s.updateSport(sp.id, { placeIds: [...sp.placeIds, id] })}
                    onCreate={(name) => {
                      const id = s.addPlace(name);
                      const cur = useStore.getState().ws.sports.find((x) => x.id === sp.id)!;
                      s.updateSport(sp.id, { placeIds: [...cur.placeIds, id] });
                    }}
                  />
                </div>
                <div className="mt-auto flex flex-wrap gap-1 pt-2">
                  {levels.length ? (
                    levels.map((l) => (
                      <span key={l.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {l.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Aucune classe</span>
                  )}
                </div>
              </Column>
            );
          })}
          <AddColumn label="Ajouter un sport" onAdd={() => s.addSport(`Sport ${ws.sports.length + 1}`)} />
        </Board>
      )}
    </>
  );
}
