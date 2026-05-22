import type { ReactNode } from "react";

/**
 * Section repliable pour la page Paramètres.
 * Utilise <details>/<summary> natifs — pas de JS client requis,
 * fonctionne côté SSR et conserve l'état d'ouverture pendant la session.
 *
 * Props :
 * - accent : couleur de la barre latérale (tailwind bg-*)
 * - title  : titre de la section
 * - subtitle : sous-titre / description (optionnel, affiché sous le titre)
 * - badge  : pastille rapide à droite du titre (ex: "3 alertes", "32 utilisateurs")
 * - defaultOpen : ouverte par défaut ?
 * - htmlId : ancrage pour les liens internes
 */
export function CollapsibleSection({
  accent = "bg-sc-blue",
  title,
  subtitle,
  badge,
  defaultOpen = false,
  htmlId,
  children,
}: {
  accent?: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  htmlId?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={htmlId}
      open={defaultOpen}
      className="group scroll-mt-8 overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition hover:bg-sc-blue-bg/40 [&::-webkit-details-marker]:hidden">
        {/* Barre d'accent */}
        <span className={`h-[18px] w-1 flex-shrink-0 rounded ${accent}`} />

        {/* Titre + sous-titre */}
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-baseline gap-2 font-serif text-base font-semibold text-sc-blue-darker">
            {title}
            {badge && (
              <span className="text-[11.5px] font-normal text-gray-500">
                {badge}
              </span>
            )}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-gray-500">{subtitle}</p>
          )}
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
        </svg>
      </summary>

      <div className="border-t border-sc-border px-4 py-5">{children}</div>
    </details>
  );
}
