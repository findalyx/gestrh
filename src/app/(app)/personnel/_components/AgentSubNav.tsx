import Link from "next/link";

export type AgentSubSegment =
  | "avenants"
  | "renouvellement"
  | "documents"
  | "notifications"
  | "demission"
  | "conformite";

const LINKS: { seg: AgentSubSegment; label: string }[] = [
  { seg: "avenants", label: "Avenants" },
  { seg: "renouvellement", label: "Renouvellement" },
  { seg: "documents", label: "Documents" },
  { seg: "notifications", label: "Notifications" },
  { seg: "demission", label: "Démission" },
  { seg: "conformite", label: "Conformité" },
];

/**
 * Barre de navigation entre les sous-sections « workflow contrats » d'un
 * agent. Remplace l'ancienne barre d'onglets : la fiche agent principale
 * reste une page autonome, ces sections sont des sous-pages reliées.
 */
export function AgentSubNav({
  agentId,
  active,
  agentName,
}: {
  agentId: string;
  active: AgentSubSegment;
  agentName?: string;
}) {
  return (
    <div className="mb-5">
      <Link
        href={`/personnel/${agentId}`}
        className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-sc-blue hover:underline"
      >
        ← Fiche agent{agentName ? ` · ${agentName}` : ""}
      </Link>
      <nav className="flex flex-wrap gap-1 rounded-lg border border-sc-border bg-white p-1.5">
        {LINKS.map((l) => {
          const isActive = active === l.seg;
          return (
            <Link
              key={l.seg}
              href={`/personnel/${agentId}/${l.seg}`}
              className={
                isActive
                  ? "rounded-md bg-sc-blue px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"
                  : "rounded-md px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker transition hover:bg-sc-blue-light"
              }
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
