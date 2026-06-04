"use server";

import { revalidatePath } from "next/cache";
import { ContractStatus, ResignationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { deleteSignedPrefix, saveSignedFile } from "@/lib/signed-storage";

function requireDate(formData: FormData, key: string, label: string): Date {
  const v = formData.get(key);
  if (typeof v !== "string" || !v) throw new Error(`Le champ « ${label} » est obligatoire.`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide pour « ${label} ».`);
  return d;
}

function pickString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function resignationPrefix(resignationId: string): string {
  return `resignations/${resignationId}/signed`;
}

// ---------------------------------------------------------------
//  Soumission
// ---------------------------------------------------------------

export async function submitResignation(
  contractId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      agentId: true,
      status: true,
      noticePeriodDays: true,
      resignation: { select: { id: true, status: true } },
    },
  });
  if (!contract) throw new Error("Contrat introuvable.");
  if (contract.status !== ContractStatus.ACTIF) {
    throw new Error("Seul un contrat actif peut faire l'objet d'une démission.");
  }
  if (contract.resignation) {
    const s = contract.resignation.status;
    const reopenable: ResignationStatus[] = [
      ResignationStatus.REJETEE,
      ResignationStatus.ANNULEE,
    ];
    if (!reopenable.includes(s)) {
      throw new Error("Une démission est déjà en cours pour ce contrat.");
    }
    // On retire l'ancienne (rejetée/annulée) pour permettre une nouvelle soumission.
    await deleteSignedPrefix(resignationPrefix(contract.resignation.id));
    await prisma.resignation.delete({ where: { id: contract.resignation.id } });
  }

  const effectiveDate = requireDate(formData, "effectiveDate", "Date de départ");
  if (effectiveDate.getTime() < Date.now() - 86_400_000) {
    throw new Error("La date de départ ne peut pas être dans le passé.");
  }
  const reason = pickString(formData, "reason") || null;
  const noticeStart = new Date();

  const created = await prisma.resignation.create({
    data: {
      contractId,
      effectiveDate,
      noticeStartDate: noticeStart,
      reason,
      status: ResignationStatus.SOUMISE,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "SUBMIT_RESIGNATION",
    entity: "Resignation",
    entityId: created.id,
    details: `Contrat ${contractId} · départ ${effectiveDate.toISOString().slice(0, 10)}`,
  });

  revalidatePath(`/personnel/${contract.agentId}/demission`);
  revalidatePath(`/personnel/${contract.agentId}`);
}

// ---------------------------------------------------------------
//  Annulation (uniquement si encore SOUMISE)
// ---------------------------------------------------------------

export async function cancelResignation(resignationId: string): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const r = await prisma.resignation.findUnique({
    where: { id: resignationId },
    select: { status: true, contract: { select: { agentId: true } } },
  });
  if (!r) throw new Error("Démission introuvable.");
  if (r.status !== ResignationStatus.SOUMISE) {
    throw new Error("Seule une démission encore en attente peut être annulée.");
  }
  await prisma.resignation.update({
    where: { id: resignationId },
    data: { status: ResignationStatus.ANNULEE, decidedAt: new Date() },
  });

  await logAudit({
    userId: me.id,
    action: "CANCEL_RESIGNATION",
    entity: "Resignation",
    entityId: resignationId,
  });

  revalidatePath(`/personnel/${r.contract.agentId}/demission`);
  revalidatePath(`/personnel/${r.contract.agentId}`);
}

// ---------------------------------------------------------------
//  Décision DRH : accepter ou refuser
// ---------------------------------------------------------------

export async function decideResignation(
  resignationId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const decision = pickString(formData, "decision");
  if (decision !== "accept" && decision !== "reject") {
    throw new Error("Décision invalide.");
  }
  const hrComment = pickString(formData, "hrComment") || null;

  const r = await prisma.resignation.findUnique({
    where: { id: resignationId },
    select: { status: true, contract: { select: { agentId: true } } },
  });
  if (!r) throw new Error("Démission introuvable.");
  if (r.status !== ResignationStatus.SOUMISE) {
    throw new Error("Une décision a déjà été enregistrée.");
  }

  await prisma.resignation.update({
    where: { id: resignationId },
    data: {
      status:
        decision === "accept"
          ? ResignationStatus.ACCEPTEE
          : ResignationStatus.REJETEE,
      hrComment,
      decidedAt: new Date(),
      decidedById: me.id,
    },
  });

  await logAudit({
    userId: me.id,
    action: decision === "accept" ? "ACCEPT_RESIGNATION" : "REJECT_RESIGNATION",
    entity: "Resignation",
    entityId: resignationId,
  });

  revalidatePath(`/personnel/${r.contract.agentId}/demission`);
  revalidatePath(`/personnel/${r.contract.agentId}`);
}

// ---------------------------------------------------------------
//  Upload de la lettre signée scannée
// ---------------------------------------------------------------

export async function uploadSignedResignation(
  resignationId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Aucun fichier sélectionné.");
  }

  const r = await prisma.resignation.findUnique({
    where: { id: resignationId },
    select: { status: true, contract: { select: { agentId: true } } },
  });
  if (!r) throw new Error("Démission introuvable.");
  if (
    r.status === ResignationStatus.REJETEE ||
    r.status === ResignationStatus.ANNULEE
  ) {
    throw new Error(
      "Impossible de joindre une lettre signée pour une démission refusée ou annulée.",
    );
  }

  const saved = await saveSignedFile(resignationPrefix(resignationId), file);
  if (!saved.ok) throw new Error(saved.error);

  await prisma.resignation.update({
    where: { id: resignationId },
    data: {
      signedFileName: saved.filename,
      signedMimeType: saved.mimeType,
      signedSize: saved.size,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_SIGNED_RESIGNATION",
    entity: "Resignation",
    entityId: resignationId,
    details: saved.filename,
  });

  revalidatePath(`/personnel/${r.contract.agentId}/demission`);
  revalidatePath(`/personnel/${r.contract.agentId}`);
}

// ---------------------------------------------------------------
//  Marquage effectif (départ réalisé → contrat ROMPU)
// ---------------------------------------------------------------

export async function markResignationEffective(
  resignationId: string,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const r = await prisma.resignation.findUnique({
    where: { id: resignationId },
    select: {
      status: true,
      contractId: true,
      signedFileName: true,
      contract: { select: { agentId: true } },
    },
  });
  if (!r) throw new Error("Démission introuvable.");
  if (r.status !== ResignationStatus.ACCEPTEE) {
    throw new Error("Seule une démission acceptée peut être marquée comme effective.");
  }
  if (!r.signedFileName) {
    throw new Error(
      "La lettre signée doit être déposée avant de marquer la démission effective.",
    );
  }

  await prisma.$transaction([
    prisma.resignation.update({
      where: { id: resignationId },
      data: { status: ResignationStatus.EFFECTIVE },
    }),
    prisma.contract.update({
      where: { id: r.contractId },
      data: { status: ContractStatus.ROMPU },
    }),
  ]);

  await logAudit({
    userId: me.id,
    action: "MARK_RESIGNATION_EFFECTIVE",
    entity: "Resignation",
    entityId: resignationId,
    details: `Contrat ${r.contractId} → ROMPU`,
  });

  revalidatePath(`/personnel/${r.contract.agentId}/demission`);
  revalidatePath(`/personnel/${r.contract.agentId}/contrat`);
  revalidatePath(`/personnel/${r.contract.agentId}`);
}
