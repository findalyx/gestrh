"use server";

import { revalidatePath } from "next/cache";
import {
  ContractNotificationKind,
  ContractStatus,
  ContractType,
  RenewalDecision,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { buildNotificationDocx } from "@/lib/docx/notification";

function pickString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseRequiredDate(formData: FormData, key: string, label: string): Date {
  const v = pickString(formData, key);
  if (!v) throw new Error(`Le champ « ${label} » est obligatoire.`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide pour « ${label} ».`);
  return d;
}

function pickDate(formData: FormData, key: string): Date | null {
  const v = pickString(formData, key);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------
//  Ouverture d'un dossier de renouvellement
// ---------------------------------------------------------------

export async function openRenewal(contractId: string): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      type: true,
      status: true,
      agentId: true,
      reference: true,
      renewal: { select: { id: true } },
    },
  });
  if (!contract) throw new Error("Contrat introuvable.");
  if (contract.renewal) throw new Error("Un dossier de renouvellement existe déjà.");
  if (contract.type !== ContractType.CDD) {
    throw new Error("Seul un CDD peut faire l'objet d'un renouvellement.");
  }
  if (contract.status !== ContractStatus.ACTIF) {
    throw new Error("Le contrat doit être actif pour ouvrir un renouvellement.");
  }

  const created = await prisma.contractRenewal.create({
    data: {
      contractId: contract.id,
      decision: RenewalDecision.EN_COURS,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "OPEN_RENEWAL",
    entity: "ContractRenewal",
    entityId: created.id,
    details: `Ouverture · contrat ${contract.reference}`,
  });

  revalidatePath(`/personnel/${contract.agentId}/renouvellement`);
  revalidatePath(`/personnel/${contract.agentId}`);
}

// ---------------------------------------------------------------
//  Décision DRH
// ---------------------------------------------------------------

export async function decideRenewal(
  renewalId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const decision = pickString(formData, "decision") as RenewalDecision;
  if (
    decision !== RenewalDecision.RENOUVELE &&
    decision !== RenewalDecision.CONVERTI_CDI &&
    decision !== RenewalDecision.NON_RENOUVELE
  ) {
    throw new Error("Décision invalide.");
  }
  const reason = pickString(formData, "reason") || null;

  const renewal = await prisma.contractRenewal.findUnique({
    where: { id: renewalId },
    include: { contract: { include: { agent: true } } },
  });
  if (!renewal) throw new Error("Dossier de renouvellement introuvable.");
  if (renewal.decision !== RenewalDecision.EN_COURS) {
    throw new Error("Une décision a déjà été enregistrée pour ce dossier.");
  }

  const decidedById = me.id;

  if (decision === RenewalDecision.RENOUVELE) {
    const newEndDate = parseRequiredDate(formData, "newEndDate", "Nouvelle date de fin");
    if (renewal.contract.endDate && newEndDate <= renewal.contract.endDate) {
      throw new Error("La nouvelle date de fin doit être postérieure à l'échéance actuelle.");
    }
    await prisma.$transaction([
      prisma.contractRenewal.update({
        where: { id: renewalId },
        data: { decision, reason, newEndDate, decidedAt: new Date(), decidedById },
      }),
      prisma.contract.update({
        where: { id: renewal.contractId },
        data: { endDate: newEndDate },
      }),
    ]);
  } else if (decision === RenewalDecision.CONVERTI_CDI) {
    const startDate = pickDate(formData, "newStartDate") ?? renewal.contract.endDate ?? new Date();
    // Crée un nouveau contrat CDI en attente de signature, marque l'ancien comme RENOUVELE.
    const matricule = renewal.contract.agent.matricule;
    const baseRef = `CTR-${matricule}-CDI-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await prisma.$transaction(async (tx) => {
      const newContract = await tx.contract.create({
        data: {
          reference: baseRef,
          type: ContractType.CDI,
          status: ContractStatus.EN_ATTENTE_SIGNATURE,
          startDate,
          endDate: null,
          grade: renewal.contract.grade,
          baseSalary: renewal.contract.baseSalary,
          workingHours: renewal.contract.workingHours,
          noticePeriodDays: renewal.contract.noticePeriodDays,
          clauses: renewal.contract.clauses,
          agentId: renewal.contract.agentId,
        },
      });
      await tx.contract.update({
        where: { id: renewal.contractId },
        data: { status: ContractStatus.RENOUVELE },
      });
      await tx.contractRenewal.update({
        where: { id: renewalId },
        data: {
          decision,
          reason,
          decidedAt: new Date(),
          decidedById,
          newContractId: newContract.id,
        },
      });
    });
  } else {
    // NON_RENOUVELE — le contrat expirera naturellement à son endDate
    await prisma.contractRenewal.update({
      where: { id: renewalId },
      data: { decision, reason, decidedAt: new Date(), decidedById },
    });
  }

  await logAudit({
    userId: me.id,
    action: "DECIDE_RENEWAL",
    entity: "ContractRenewal",
    entityId: renewalId,
    details: `${decision} · contrat ${renewal.contract.reference}`,
  });

  revalidatePath(`/personnel/${renewal.contract.agentId}/renouvellement`);
  revalidatePath(`/personnel/${renewal.contract.agentId}/contrat`);
  revalidatePath(`/personnel/${renewal.contract.agentId}`);
}

// ---------------------------------------------------------------
//  Envoi de la notification formelle à l'agent
// ---------------------------------------------------------------

export async function sendRenewalNotification(renewalId: string): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const renewal = await prisma.contractRenewal.findUnique({
    where: { id: renewalId },
    include: { contract: { include: { agent: { include: { service: true } } } } },
  });
  if (!renewal) throw new Error("Dossier de renouvellement introuvable.");
  if (renewal.decision === RenewalDecision.EN_COURS) {
    throw new Error("Aucune décision à notifier.");
  }
  if (renewal.notifiedAt) {
    throw new Error("L'agent a déjà été notifié pour ce dossier.");
  }

  const kind =
    renewal.decision === RenewalDecision.NON_RENOUVELE
      ? ContractNotificationKind.NON_RENOUVELLEMENT
      : ContractNotificationKind.RENOUVELLEMENT;

  // On ne génère ici que le sujet et le corps. La lettre .docx est régénérée
  // à la volée par la route /api/contract-notifications/[id] ; aucun octet
  // n'est persisté sur ContractNotification.
  const { subject, body } = await buildNotificationDocx(
    kind,
    renewal.contract.agent,
    renewal.contract,
    renewal.contract.agent.service,
    { newEndDate: renewal.newEndDate, reason: renewal.reason },
  );

  await prisma.$transaction([
    prisma.contractNotification.create({
      data: {
        contractId: renewal.contractId,
        kind,
        subject,
        body,
        sentById: me.id,
      },
    }),
    prisma.contractRenewal.update({
      where: { id: renewalId },
      data: { notifiedAt: new Date() },
    }),
  ]);

  await logAudit({
    userId: me.id,
    action: "NOTIFY_RENEWAL",
    entity: "ContractRenewal",
    entityId: renewalId,
    details: `${kind} · contrat ${renewal.contract.reference}`,
  });

  revalidatePath(`/personnel/${renewal.contract.agentId}/renouvellement`);
  revalidatePath(`/personnel/${renewal.contract.agentId}/notifications`);
  revalidatePath(`/personnel/${renewal.contract.agentId}`);
}
