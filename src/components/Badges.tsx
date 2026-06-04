import type {
  AgentStatus,
  StaffCategory,
  ContractStatus,
  ContractType,
} from "@prisma/client";

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider";

export function CategoryBadge({ value }: { value: StaffCategory }) {
  const style =
    value === "PER"
      ? "bg-sc-blue-light text-sc-blue"
      : "bg-sc-green-light text-sc-green-dark";
  return <span className={`${BASE} ${style}`}>{value}</span>;
}

const AGENT_STATUS_STYLE: Record<AgentStatus, string> = {
  ACTIF: "bg-sc-green-light text-sc-green-dark",
  SUSPENDU: "bg-sc-warning-light text-[#854f0b]",
  RETRAITE: "bg-gray-100 text-gray-600",
  INACTIF: "bg-sc-danger-light text-sc-danger",
};

const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RETRAITE: "Retraité",
  INACTIF: "Inactif",
};

export function AgentStatusBadge({ value }: { value: AgentStatus }) {
  return (
    <span className={`${BASE} ${AGENT_STATUS_STYLE[value]}`}>
      {AGENT_STATUS_LABEL[value]}
    </span>
  );
}

const CONTRACT_STATUS_STYLE: Record<ContractStatus, string> = {
  ACTIF: "bg-sc-green-light text-sc-green-dark",
  EXPIRE: "bg-gray-100 text-gray-600",
  RENOUVELE: "bg-sc-blue-light text-sc-blue",
  RESILIE: "bg-sc-danger-light text-sc-danger",
  EN_ATTENTE_SIGNATURE: "bg-sc-warning-light text-sc-warning-dark",
  ROMPU: "bg-sc-danger-light text-sc-danger",
};

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  RENOUVELE: "Renouvelé",
  RESILIE: "Résilié",
  EN_ATTENTE_SIGNATURE: "En attente de signature",
  ROMPU: "Rompu",
};

export function ContractStatusBadge({ value }: { value: ContractStatus }) {
  return (
    <span className={`${BASE} ${CONTRACT_STATUS_STYLE[value]}`}>
      {CONTRACT_STATUS_LABEL[value]}
    </span>
  );
}

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
  STAGE: "Stage",
};

export function ContractTypeLabel({ value }: { value: ContractType }) {
  return <>{CONTRACT_TYPE_LABEL[value]}</>;
}
