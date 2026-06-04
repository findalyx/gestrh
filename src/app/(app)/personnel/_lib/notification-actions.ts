"use server";

import { revalidatePath } from "next/cache";
import { ContractNotificationKind, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { buildNotificationDocx } from "@/lib/docx/notification";

const KIND_LABEL: Record<ContractNotificationKind, string> = {
  RENOUVELLEMENT: "Renouvellement de contrat",
  NON_RENOUVELLEMENT: "Non-renouvellement de contrat",
  CONFIRMATION_PERIODE_ESSAI: "Confirmation de période d'essai",
  FIN_PERIODE_ESSAI: "Fin de période d'essai",
  RUPTURE_ANTICIPEE: "Rupture anticipée",
};

export async function sendStandaloneNotification(
  contractId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const kindStr = formData.get("kind");
  if (typeof kindStr !== "string") throw new Error("Type de notification manquant.");
  const kind = kindStr as ContractNotificationKind;
  if (!Object.values(ContractNotificationKind).includes(kind)) {
    throw new Error("Type de notification invalide.");
  }
  const reason =
    typeof formData.get("reason") === "string"
      ? (formData.get("reason") as string).trim() || null
      : null;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { agent: { include: { service: true } } },
  });
  if (!contract) throw new Error("Contrat introuvable.");

  // Les lettres sont générées à la volée : on calcule seulement subject/body.
  const { subject, body } = await buildNotificationDocx(
    kind,
    contract.agent,
    contract,
    contract.agent.service,
    { reason },
  );

  const created = await prisma.contractNotification.create({
    data: {
      contractId,
      kind,
      subject,
      body,
      sentById: me.id,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "SEND_CONTRACT_NOTIFICATION",
    entity: "ContractNotification",
    entityId: created.id,
    details: `${KIND_LABEL[kind]} · ${contract.reference}`,
  });

  revalidatePath(`/personnel/${contract.agentId}/notifications`);
  revalidatePath(`/personnel/${contract.agentId}`);
}

export async function acknowledgeNotification(notificationId: string): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const n = await prisma.contractNotification.findUnique({
    where: { id: notificationId },
    select: { id: true, subject: true, contract: { select: { agentId: true } } },
  });
  if (!n) throw new Error("Notification introuvable.");

  await prisma.contractNotification.update({
    where: { id: notificationId },
    data: { acknowledgedAt: new Date() },
  });

  await logAudit({
    userId: me.id,
    action: "ACKNOWLEDGE_CONTRACT_NOTIFICATION",
    entity: "ContractNotification",
    entityId: notificationId,
    details: n.subject,
  });

  revalidatePath(`/personnel/${n.contract.agentId}/notifications`);
}
