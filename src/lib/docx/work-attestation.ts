import { ContractType, type Agent, type Contract } from "@prisma/client";
import { formatDate } from "@/lib/contract-utils";
import { buildAttestationDocx, civilite } from "./attestation-base";

type AgentLite = Pick<
  Agent,
  "firstName" | "lastName" | "gender" | "jobTitle" | "hireDate"
>;
type ContractLite = Pick<Contract, "type" | "startDate"> | null;

const CONTRACT_PHRASE: Record<ContractType, string> = {
  CDI: "sous contrat à durée indéterminée",
  CDD: "sous contrat à durée déterminée",
  STAGE: "en stage",
  VACATAIRE: "sous contrat de vacation",
  PRESTATION: "sous contrat de prestation de service",
};

function fullName(agent: AgentLite): string {
  return `${agent.firstName} ${agent.lastName.toUpperCase()}`;
}

/**
 * Attestation de Travail — calée sur le modèle de l'organisation.
 * `reference` : numéro de référence (ex. « 0142/SCIMD/DG/acy »).
 */
export async function buildWorkAttestationDocx(
  agent: AgentLite,
  contract: ContractLite,
  reference?: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const c = civilite(agent.gender);

  const body: string[] = [
    `Je soussigné, Directeur Général de Saint Christopher Iba Mar Diop SA, ` +
      `atteste que ${c.long} ${fullName(agent)}, employ${c.ne} dans notre ` +
      `institution depuis le ${formatDate(agent.hireDate)}.`,
  ];

  if (contract) {
    body.push(
      `${c.court} ${agent.lastName.toUpperCase()} est ` +
        `${CONTRACT_PHRASE[contract.type]} depuis le ${formatDate(contract.startDate)} ` +
        `et occupe le poste de ${agent.jobTitle}.`,
    );
  } else {
    body.push(
      `${c.court} ${agent.lastName.toUpperCase()} occupe le poste de ${agent.jobTitle}.`,
    );
  }

  return buildAttestationDocx({
    docTitle: `Attestation de travail — ${agent.firstName} ${agent.lastName}`,
    topLeft: "LE DIRECTEUR GENERAL",
    topRightLines: [
      `Dakar, le ${formatDate(new Date())}`,
      `N° ${reference ?? "_______"}/SCIMD/DG/acy`,
    ],
    title: "Attestation de Travail",
    bodyParas: body,
    closing: "Attestation faite pour servir et valoir ce que de droit.",
    signatureLines: ["Pour le Directeur Général,", "Le Doyen Exécutif"],
  });
}
