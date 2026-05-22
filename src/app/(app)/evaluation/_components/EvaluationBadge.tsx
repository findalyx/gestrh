import { EvaluationStatus } from "@prisma/client";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider";

const STATUS_STYLE: Record<EvaluationStatus, string> = {
  PLANIFIEE: "bg-gray-100 text-gray-700",
  EN_COURS: "bg-sc-blue-light text-sc-blue",
  TERMINEE: "bg-sc-green-light text-sc-green-dark",
  EN_RETARD: "bg-sc-danger-light text-sc-danger",
};

const STATUS_LABEL: Record<EvaluationStatus, string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  EN_RETARD: "En retard",
};

export function EvaluationStatusBadge({
  status,
  dueDate,
  completedAt,
}: {
  status: EvaluationStatus;
  dueDate: Date | null;
  completedAt: Date | null;
}) {
  // Détection "en retard" dynamique
  const effective =
    status !== EvaluationStatus.TERMINEE &&
    dueDate &&
    dueDate.getTime() < Date.now() &&
    !completedAt
      ? EvaluationStatus.EN_RETARD
      : status;

  return (
    <span className={`${BASE} ${STATUS_STYLE[effective]}`}>
      {STATUS_LABEL[effective]}
    </span>
  );
}
