"use server";

import { revalidatePath } from "next/cache";
import { AmendmentType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { deleteSignedPrefix, saveSignedFile } from "@/lib/signed-storage";

function pickString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function requireDate(formData: FormData, key: string, label: string): Date {
  const v = pickString(formData, key);
  if (!v) throw new Error(`Le champ « ${label} » est obligatoire.`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide pour « ${label} ».`);
  return d;
}

function amendmentPrefix(amendmentId: string): string {
  return `amendments/${amendmentId}/signed`;
}

async function nextAmendmentReference(contractRef: string): Promise<string> {
  const count = await prisma.contractAmendment.count({
    where: { contract: { reference: contractRef } },
  });
  return `AV-${contractRef}-${String(count + 1).padStart(3, "0")}`;
}

export async function createAmendment(
  contractId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const type = pickString(formData, "type") as AmendmentType;
  if (!Object.values(AmendmentType).includes(type)) {
    throw new Error("Type d'avenant invalide.");
  }
  const description = pickString(formData, "description");
  if (!description) throw new Error("La description est obligatoire.");
  const effectiveDate = requireDate(formData, "effectiveDate", "Date d'effet");
  const oldValue = pickString(formData, "oldValue") || null;
  const newValue = pickString(formData, "newValue") || null;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, reference: true, agentId: true },
  });
  if (!contract) throw new Error("Contrat introuvable.");

  const reference = await nextAmendmentReference(contract.reference);

  const created = await prisma.contractAmendment.create({
    data: {
      contractId,
      reference,
      type,
      description,
      effectiveDate,
      oldValue,
      newValue,
    },
    select: { id: true },
  });

  await logAudit({
    userId: me.id,
    action: "CREATE_AMENDMENT",
    entity: "ContractAmendment",
    entityId: created.id,
    details: `${reference} · ${type}`,
  });

  revalidatePath(`/personnel/${contract.agentId}/avenants`);
  revalidatePath(`/personnel/${contract.agentId}`);
}

export async function uploadSignedAmendment(
  amendmentId: string,
  formData: FormData,
): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Aucun fichier sélectionné.");
  }

  const a = await prisma.contractAmendment.findUnique({
    where: { id: amendmentId },
    select: { id: true, reference: true, contract: { select: { agentId: true } } },
  });
  if (!a) throw new Error("Avenant introuvable.");

  const saved = await saveSignedFile(amendmentPrefix(amendmentId), file);
  if (!saved.ok) throw new Error(saved.error);

  await prisma.contractAmendment.update({
    where: { id: amendmentId },
    data: {
      signedFileName: saved.filename,
      signedMimeType: saved.mimeType,
      signedSize: saved.size,
      signedAt: new Date(),
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_SIGNED_AMENDMENT",
    entity: "ContractAmendment",
    entityId: amendmentId,
    details: `${a.reference} · ${saved.filename}`,
  });

  revalidatePath(`/personnel/${a.contract.agentId}/avenants`);
}

export async function deleteAmendment(amendmentId: string): Promise<void> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const a = await prisma.contractAmendment.findUnique({
    where: { id: amendmentId },
    select: { id: true, reference: true, contract: { select: { agentId: true } } },
  });
  if (!a) throw new Error("Avenant introuvable.");

  await deleteSignedPrefix(amendmentPrefix(amendmentId));
  await prisma.contractAmendment.delete({ where: { id: amendmentId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_AMENDMENT",
    entity: "ContractAmendment",
    entityId: amendmentId,
    details: a.reference,
  });

  revalidatePath(`/personnel/${a.contract.agentId}/avenants`);
}
