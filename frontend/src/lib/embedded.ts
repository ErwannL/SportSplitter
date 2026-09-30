/** Vrai quand la page est affichée dans un iframe (la console d'Orqea) : le retour sur Orqea y est masqué. */
export function inIframe(): boolean {
  return window.self !== window.top;
}
