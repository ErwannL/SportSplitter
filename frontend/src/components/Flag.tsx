/** Petits drapeaux en SVG (les émojis drapeaux ne s'affichent pas sous Windows). */
export function Flag({ lang, className = "h-3.5 w-5" }: { lang: "fr" | "en"; className?: string }) {
  if (lang === "fr")
    return (
      <svg viewBox="0 0 3 2" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
        <rect width="1" height="2" fill="#002654" />
        <rect x="1" width="1" height="2" fill="#ffffff" />
        <rect x="2" width="1" height="2" fill="#ce1126" />
      </svg>
    );
  return (
    <svg viewBox="0 0 60 30" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <clipPath id="gb-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
