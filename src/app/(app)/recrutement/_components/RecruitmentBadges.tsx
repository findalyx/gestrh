import { ApplicationStage, JobStatus } from "@prisma/client";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider";

// OUVERT et EN_COURS sont tous deux affichés "En cours" : une offre est en
// cours tant qu'elle accepte des candidats, indépendamment de l'avancement
// du pipeline qui se voit déjà dans le détail.
const JOB_STATUS_STYLE: Record<JobStatus, string> = {
  OUVERT: "bg-sc-green-light text-sc-green-dark",
  EN_COURS: "bg-sc-green-light text-sc-green-dark",
  POURVU: "bg-sc-teal-light text-sc-teal-dark",
  FERME: "bg-gray-100 text-gray-600",
};

const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  OUVERT: "En cours",
  EN_COURS: "En cours",
  POURVU: "Pourvue",
  FERME: "Fermée",
};

export function JobStatusBadge({ value }: { value: JobStatus }) {
  return <span className={`${BASE} ${JOB_STATUS_STYLE[value]}`}>{JOB_STATUS_LABEL[value]}</span>;
}

const STAGE_STYLE: Record<ApplicationStage, string> = {
  CANDIDATURE: "bg-gray-100 text-gray-700",
  PRESELECTION: "bg-sc-blue-light text-sc-blue",
  ENTRETIEN: "bg-sc-warning-light text-[#854f0b]",
  FINALISTE: "bg-sc-purple-light text-sc-purple",
  RECRUTE: "bg-sc-green-light text-sc-green-dark",
  REJETE: "bg-sc-danger-light text-sc-danger",
};

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  CANDIDATURE: "Candidature",
  PRESELECTION: "Présélection",
  ENTRETIEN: "Entretien",
  FINALISTE: "Finaliste",
  RECRUTE: "Recruté",
  REJETE: "Rejeté",
};

export function ApplicationStageBadge({ value }: { value: ApplicationStage }) {
  return <span className={`${BASE} ${STAGE_STYLE[value]}`}>{STAGE_LABEL[value]}</span>;
}
