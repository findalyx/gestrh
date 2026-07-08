import { LeaveDecision, LeaveStatus } from "@prisma/client";

/**
 * Fil d'historique d'une demande de congé : dépôt → décisions successives →
 * état courant. Rendu serveur (pas d'interactivité), affiché dans un <details>.
 */

export type TimelineApproval = {
  level: number;
  decision: LeaveDecision;
  comment: string | null;
  decidedAt: Date;
  decidedBy: {
    email: string;
    agent: { firstName: string; lastName: string } | null;
  } | null;
};

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function deciderName(a: TimelineApproval): string {
  if (a.decidedBy?.agent) {
    return `${a.decidedBy.agent.firstName} ${a.decidedBy.agent.lastName.toUpperCase()}`;
  }
  return a.decidedBy?.email ?? "—";
}

export function LeaveTimeline({
  createdAt,
  approvals,
  status,
  currentLevel,
}: {
  createdAt: Date;
  approvals: TimelineApproval[];
  status: LeaveStatus;
  currentLevel: number | null;
}) {
  return (
    <ol className="mt-2 space-y-3 border-l-2 border-sc-border pl-4">
      {/* Dépôt */}
      <li className="relative">
        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sc-blue" />
        <p className="text-[12px] font-medium text-sc-blue-darker">
          Demande déposée
        </p>
        <p className="text-[11px] text-gray-500">{fmt(createdAt)}</p>
      </li>

      {/* Décisions successives */}
      {approvals.map((a, i) => {
        const favorable = a.decision === LeaveDecision.FAVORABLE;
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                favorable ? "bg-sc-green" : "bg-sc-danger"
              }`}
            />
            <p className="text-[12px] font-medium text-sc-blue-darker">
              {favorable ? "✓ Validé" : "✗ Refusé"} — niveau {a.level}
            </p>
            <p className="text-[11px] text-gray-600">
              par {deciderName(a)} · {fmt(a.decidedAt)}
            </p>
            {a.comment && (
              <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 text-[11.5px] text-gray-700">
                « {a.comment} »
              </p>
            )}
          </li>
        );
      })}

      {/* État courant */}
      {status === LeaveStatus.EN_ATTENTE && (
        <li className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sc-warning" />
          <p className="text-[12px] font-medium text-[#854f0b]">
            ⏳ En attente de validation
            {currentLevel ? ` — niveau ${currentLevel}` : ""}
          </p>
        </li>
      )}
      {status === LeaveStatus.AUTORISE && (
        <li className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sc-green" />
          <p className="text-[12px] font-medium text-sc-green-dark">
            ✅ Congé autorisé
          </p>
        </li>
      )}
      {status === LeaveStatus.ANNULE && (
        <li className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gray-400" />
          <p className="text-[12px] font-medium text-gray-500">
            Demande annulée
          </p>
        </li>
      )}
    </ol>
  );
}
