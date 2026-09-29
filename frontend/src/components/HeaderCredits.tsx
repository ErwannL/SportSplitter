import clsx from "clsx";
import { CREDITS, type Credits } from "../lib/credits";
import { useAuth } from "../auth";
import { useT } from "../prefs";

const EXTERNAL = { target: "_blank", rel: "noreferrer noopener" } as const;

/**
 * « Boosted by Orqea » / « Developed by Erwann Laplante » : deux liens distincts, empilés.
 * Une ligne disparaît si son nom est vide ; le bloc ne rend rien si les deux le sont.
 * `compact` : seule la mention du propriétaire (menu replié), avec son aria-label complet.
 */
/** Couleurs des liens : `side` sur le menu sombre, `light` sur un écran clair (sans session). */
const TONES = {
  side: { owner: "text-side-text hover:text-on", author: "text-side-muted hover:text-on" },
  light: { owner: "text-slate-600 hover:text-indigo-600", author: "text-slate-500 hover:text-indigo-600" },
} as const;

export function HeaderCredits({
  credits,
  compact = false,
  className,
  tone = "side",
}: {
  credits?: Credits;
  compact?: boolean;
  className?: string;
  tone?: keyof typeof TONES;
}) {
  const t = useT();
  const orqeaUrl = useAuth((s) => s.orqeaUrl);
  const { owner, author } = credits ?? { ...CREDITS, owner: { ...CREDITS.owner, href: orqeaUrl } };
  const showAuthor = !compact && !!author.name;
  if (!owner.name && !showAuthor) return null;
  const ownerLabel = t("credits.owner", { name: owner.name });
  const authorLabel = t("credits.author", { name: author.name });
  return (
    <div className={clsx("flex min-w-0 flex-col leading-tight", className)} data-testid="header-credits">
      {owner.name && (
        <a
          href={owner.href}
          // MÊME onglet : la session d'Orqea vit dans l'onglet (sessionStorage) ;
          // un nouvel onglet tombait sur la page de connexion d'Orqea.
          aria-label={ownerLabel}
          title={ownerLabel}
          className={clsx("truncate text-xs font-semibold transition", TONES[tone].owner)}
        >
          {compact ? owner.name : ownerLabel}
        </a>
      )}
      {showAuthor && (
        <a
          href={author.href}
          {...EXTERNAL}
          aria-label={`${authorLabel} ${t("credits.newTab")}`}
          className={clsx("truncate text-[11px] transition", TONES[tone].author)}
        >
          {authorLabel}
        </a>
      )}
    </div>
  );
}
