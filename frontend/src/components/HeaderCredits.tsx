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
export function HeaderCredits({ credits, compact = false, className }: { credits?: Credits; compact?: boolean; className?: string }) {
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
          className="truncate text-xs font-semibold text-side-text transition hover:text-on"
        >
          {compact ? owner.name : ownerLabel}
        </a>
      )}
      {showAuthor && (
        <a
          href={author.href}
          {...EXTERNAL}
          aria-label={`${authorLabel} ${t("credits.newTab")}`}
          className="truncate text-[11px] text-side-muted transition hover:text-on"
        >
          {authorLabel}
        </a>
      )}
    </div>
  );
}
