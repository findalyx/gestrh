import { type Agent, type LeaveRequest } from "@prisma/client";
import { formatDate } from "@/lib/contract-utils";
import { buildAttestationDocx, civilite } from "./attestation-base";

const TOP_LEFT = "LE DIRECTEUR GENERAL";
const SIGN = ["Pour le Directeur Général,", "Le Doyen Exécutif"];

type AgentLite = Pick<Agent, "firstName" | "lastName" | "gender" | "jobTitle">;
type LeaveLite = Pick<LeaveRequest, "startDate" | "endDate" | "days">;

/** Date de reprise = lendemain du dernier jour de congé. */
function returnDate(end: Date): Date {
  const d = new Date(end);
  d.setDate(d.getDate() + 1);
  return d;
}

function fullName(agent: AgentLite): string {
  return `${agent.firstName} ${agent.lastName.toUpperCase()}`;
}

/**
 * Attestation de Congés — calée sur le modèle de l'organisation.
 */
export async function buildLeaveAttestationDocx(
  leave: LeaveLite,
  agent: AgentLite,
): Promise<Uint8Array<ArrayBuffer>> {
  const c = civilite(agent.gender);
  const reprise = returnDate(leave.endDate);

  return buildAttestationDocx({
    docTitle: `Attestation de congés — ${agent.firstName} ${agent.lastName}`,
    topLeft: TOP_LEFT,
    title: "Attestation de Congés",
    bodyParas: [
      `Je soussigné, Directeur Général de Saint Christopher, atteste que ` +
        `${c.long} ${fullName(agent)}, employ${c.ne} dans notre institution ` +
        `en qualité de ${agent.jobTitle}, est bénéficiaire de congés pour une ` +
        `durée de ${leave.days} jour${leave.days > 1 ? "s" : ""}, sur la ` +
        `période du ${formatDate(leave.startDate)} au ${formatDate(leave.endDate)}.`,
      `${c.ielle} devra reprendre service le ${formatDate(reprise)}.`,
    ],
    closing: "Attestation faite pour servir et valoir ce que de droit.",
    placeDateLine: `Fait à Dakar, le ${formatDate(new Date())}.`,
    signatureLines: SIGN,
  });
}

/**
 * Attestation de Reprise — calée sur le modèle de l'organisation.
 * `actualReturn` permet de renseigner la date de reprise réelle ; à défaut on
 * prend le lendemain de la fin de congé.
 */
export async function buildLeaveReturnAttestationDocx(
  leave: LeaveLite,
  agent: AgentLite,
  actualReturn?: Date,
): Promise<Uint8Array<ArrayBuffer>> {
  const c = civilite(agent.gender);
  const reprise = actualReturn ?? returnDate(leave.endDate);

  return buildAttestationDocx({
    docTitle: `Attestation de reprise — ${agent.firstName} ${agent.lastName}`,
    topLeft: TOP_LEFT,
    title: "Attestation de Reprise",
    bodyParas: [
      `Je soussigné, Directeur Général de Saint Christopher, atteste que ` +
        `${c.long} ${fullName(agent)}, employ${c.ne} dans notre institution ` +
        `en qualité de ${agent.jobTitle}, bénéficiaire de congés depuis le ` +
        `${formatDate(leave.startDate)}, a effectivement repris service ce jour ` +
        `${formatDate(reprise)}.`,
    ],
    closing: "Attestation faite pour savoir et valoir ce qui de droit.",
    placeDateLine: `Fait à Dakar, le ${formatDate(new Date())}.`,
    signatureLines: SIGN,
  });
}
