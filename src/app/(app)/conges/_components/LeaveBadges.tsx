import { LeaveStatus, LeaveType } from "@prisma/client";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider";

const STATUS_STYLE: Record<LeaveStatus, string> = {
  BROUILLON: "bg-gray-100 text-gray-600",
  EN_ATTENTE: "bg-sc-warning-light text-[#854f0b]",
  // Anciens statuts (historique) — conservés pour l'affichage des vieilles demandes.
  EN_ATTENTE_CHEF: "bg-sc-warning-light text-[#854f0b]",
  EN_ATTENTE_DOYEN: "bg-sc-purple-light text-sc-purple",
  EN_ATTENTE_DG: "bg-sc-blue-light text-sc-blue",
  AUTORISE: "bg-sc-green-light text-sc-green-dark",
  REFUSE: "bg-sc-danger-light text-sc-danger",
  ANNULE: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<LeaveStatus, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  EN_ATTENTE_CHEF: "Chef de service",
  EN_ATTENTE_DOYEN: "Doyen",
  EN_ATTENTE_DG: "DG / Recteur",
  AUTORISE: "Autorisé",
  REFUSE: "Refusé",
  ANNULE: "Annulé",
};

export function LeaveStatusBadge({
  value,
  levelLabel,
}: {
  value: LeaveStatus;
  levelLabel?: string | null;
}) {
  const isWaiting =
    value === LeaveStatus.EN_ATTENTE ||
    value === LeaveStatus.EN_ATTENTE_CHEF ||
    value === LeaveStatus.EN_ATTENTE_DOYEN ||
    value === LeaveStatus.EN_ATTENTE_DG;
  // Pour le nouveau statut générique, on affiche le libellé du validateur courant.
  const text =
    value === LeaveStatus.EN_ATTENTE && levelLabel
      ? `En attente · ${levelLabel}`
      : STATUS_LABEL[value];
  return (
    <span className={`${BASE} ${STATUS_STYLE[value]}`}>
      {isWaiting && "⏳ "}
      {text}
    </span>
  );
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUEL: "Annuel",
  MALADIE: "Maladie",
  MATERNITE: "Maternité",
  PATERNITE: "Paternité",
  EXCEPTIONNEL: "Exceptionnel",
  SANS_SOLDE: "Sans solde",
};

const TYPE_STYLE: Record<LeaveType, string> = {
  ANNUEL: "bg-sc-teal-light text-sc-teal-dark",
  MALADIE: "bg-sc-danger-light text-sc-danger",
  MATERNITE: "bg-sc-purple-light text-sc-purple",
  PATERNITE: "bg-sc-purple-light text-sc-purple",
  EXCEPTIONNEL: "bg-sc-warning-light text-[#854f0b]",
  SANS_SOLDE: "bg-gray-100 text-gray-600",
};

export function LeaveTypeBadge({ value }: { value: LeaveType }) {
  return (
    <span className={`${BASE} ${TYPE_STYLE[value]}`}>
      {LEAVE_TYPE_LABEL[value]}
    </span>
  );
}
