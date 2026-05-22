import { EnrollmentStatus, TrainingStatus } from "@prisma/client";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider";

const SESSION_STYLE: Record<TrainingStatus, string> = {
  PLANIFIEE: "bg-gray-100 text-gray-700",
  OUVERTE: "bg-sc-green-light text-sc-green-dark",
  EN_COURS: "bg-sc-blue-light text-sc-blue",
  TERMINEE: "bg-sc-teal-light text-sc-teal-dark",
  ANNULEE: "bg-sc-danger-light text-sc-danger",
};

const SESSION_LABEL: Record<TrainingStatus, string> = {
  PLANIFIEE: "Planifiée",
  OUVERTE: "Ouverte",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export function SessionStatusBadge({ value }: { value: TrainingStatus }) {
  return <span className={`${BASE} ${SESSION_STYLE[value]}`}>{SESSION_LABEL[value]}</span>;
}

const ENROLLMENT_STYLE: Record<EnrollmentStatus, string> = {
  INSCRIT: "bg-sc-blue-light text-sc-blue",
  CONFIRME: "bg-sc-green-light text-sc-green-dark",
  REALISE: "bg-sc-teal-light text-sc-teal-dark",
  ABANDONNE: "bg-gray-100 text-gray-600",
};

const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  INSCRIT: "Inscrit",
  CONFIRME: "Confirmé",
  REALISE: "Réalisé",
  ABANDONNE: "Abandonné",
};

export function EnrollmentStatusBadge({ value }: { value: EnrollmentStatus }) {
  return <span className={`${BASE} ${ENROLLMENT_STYLE[value]}`}>{ENROLLMENT_LABEL[value]}</span>;
}
