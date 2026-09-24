/** Crédits affichés dans l'en-tête : une seule source de vérité, jamais en dur dans le JSX. */
export interface Credit {
  name: string;
  href: string;
}

export interface Credits {
  owner: Credit;
  author: Credit;
}

export const CREDITS: Credits = {
  owner: { name: "Orqea", href: "https://orqea.dev" },
  author: { name: "Erwann Laplante", href: "https://github.com/ErwannL/ErwannL" },
};
