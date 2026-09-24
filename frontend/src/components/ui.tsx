import clsx from "clsx";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "text-rose-600 hover:bg-rose-50",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50" title={hint}>
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={clsx(
          "flex h-5 w-5 items-center justify-center rounded-md border transition",
          checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white",
        )}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InlineEdit({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onChange(v);
    else setDraft(value);
  };
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={clsx(
        "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none transition hover:border-slate-200 focus:border-indigo-400 focus:bg-white",
        className,
      )}
    />
  );
}

/** Colonne d'un tableau de bord horizontal (niveaux, sports, lieux). */
export function Column({
  title,
  onRename,
  onDelete,
  accent,
  children,
  badge,
  width = "w-72",
}: {
  title: string;
  onRename: (v: string) => void;
  onDelete: () => void;
  accent?: string;
  badge?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <section className={clsx("flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", width)}>
      <div className="h-1.5" style={{ background: accent ?? "#6366f1" }} />
      <header className="flex items-center gap-1 border-b border-slate-100 px-3 py-3">
        <InlineEdit value={title} onChange={onRename} className="text-lg font-semibold text-slate-900" />
        {badge}
        <IconButton label="Supprimer" onClick={onDelete} className="hover:bg-rose-50 hover:text-rose-600">
          <Trash2 size={16} />
        </IconButton>
      </header>
      <div className="flex flex-1 flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</div>;
}

export function Chip({ label, color, onRemove, sub }: { label: string; color?: string; onRemove?: () => void; sub?: ReactNode }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      {color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="flex-1 truncate text-sm font-medium text-slate-700">{label}</span>
      {sub}
      {onRemove && (
        <button onClick={onRemove} aria-label={`Retirer ${label}`} className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** Champ d'ajout avec suggestions : choisir un élément existant ou en créer un nouveau. */
export function AddPicker({
  options,
  exclude,
  onPick,
  onCreate,
  placeholder,
}: {
  options: { id: string; name: string }[];
  exclude: string[];
  onPick: (id: string) => void;
  onCreate: (name: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const avail = useMemo(
    () => options.filter((o) => !exclude.includes(o.id) && o.name.toLowerCase().includes(q.trim().toLowerCase())),
    [options, exclude, q],
  );
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());
  const submit = (fn: () => void) => {
    fn();
    setQ("");
    setOpen(false);
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-400 transition hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus size={18} /> Ajouter
      </button>
    );

  return (
    <div ref={ref} className="relative">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && q.trim()) {
            const match = options.find((o) => o.name.toLowerCase() === q.trim().toLowerCase());
            submit(() => (match ? onPick(match.id) : onCreate(q.trim())));
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-indigo-300 px-3 py-2.5 text-sm outline-none ring-4 ring-indigo-100"
      />
      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        {avail.map((o) => (
          <button key={o.id} onClick={() => submit(() => onPick(o.id))} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
            {o.name}
          </button>
        ))}
        {q.trim() && !exact && (
          <button onClick={() => submit(() => onCreate(q.trim()))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50">
            <Plus size={14} /> Créer « {q.trim()} »
          </button>
        )}
        {!avail.length && !q.trim() && <div className="px-3 py-2 text-sm text-slate-400">Tapez un nom…</div>}
      </div>
    </div>
  );
}

export function AddColumn({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button
      onClick={onAdd}
      className="flex w-56 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600"
    >
      <Plus size={28} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export function PageHeader({ step, title, subtitle, actions }: { step?: number; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {step && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">Étape {step}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Board({ children }: { children: ReactNode }) {
  return <div className="-mx-2 flex min-h-[28rem] gap-4 overflow-x-auto px-2 pb-4">{children}</div>;
}
