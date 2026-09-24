import { ExternalLink, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../auth";
import { useT } from "../prefs";

/** Écran neutre : rien de l'application n'est affiché sans session. */
export function Screen({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">{icon}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{text}</p>
        {children && <div className="mt-6 flex flex-col items-center gap-2">{children}</div>}
      </div>
    </main>
  );
}

export function OrqeaButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-on shadow-sm transition hover:bg-indigo-500"
    >
      {label} <ExternalLink size={16} />
    </a>
  );
}

export function AccessScreen() {
  const t = useT();
  const orqeaUrl = useAuth((s) => s.orqeaUrl);
  return (
    <Screen icon={<ShieldAlert />} title={t("access.title")} text={t("access.text")}>
      <OrqeaButton href={orqeaUrl} label={t("access.button")} />
    </Screen>
  );
}

export function UnreachableScreen() {
  const t = useT();
  const check = useAuth((s) => s.check);
  return (
    <Screen icon={<ShieldAlert />} title={t("access.unreachable")} text={t("access.unreachableText")}>
      <button onClick={() => void check()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
        <RefreshCw size={16} /> {t("access.retry")}
      </button>
    </Screen>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-indigo-600" role="status">
      <Loader2 className="animate-spin" size={40} />
    </div>
  );
}
