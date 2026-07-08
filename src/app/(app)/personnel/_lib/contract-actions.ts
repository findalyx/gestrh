"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContractStatus, ContractType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { deleteContractFolder, saveContractPdf } from "@/lib/contract-storage";
import { createSignedUploadUrl, sanitizeFilename } from "@/lib/supabase-storage";

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/pdf";
}

const dateString = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Date invalide" });

const ContractSchema = z
  .object({
    type: z.nativeEnum(ContractType),
    status: z.nativeEnum(ContractStatus).default(ContractStatus.ACTIF),
    startDate: dateString,
    endDate: dateString.optional().or(z.literal("")),
    grade: z.string().trim().max(60).optional().or(z.literal("")),
    baseSalary: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
      z.number().int().min(0).max(50_000_000),
    ),
  })
  .superRefine((d, ctx) => {
    if (d.endDate && new Date(d.endDate) < new Date(d.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La date de fin doit suivre la date de début",
      });
    }
  });

export type ContractFormState = {
  errors?: Partial<
    Record<
      "type" | "status" | "startDate" | "endDate" | "grade" | "baseSalary" | "_form",
      string[]
    >
  >;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

export type ContractActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

/**
 * Génère une référence de contrat unique pour l'agent.
 * Format : CTR-{matricule}-{NN}
 */
async function generateContractReference(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { matricule: true },
  });
  if (!agent) throw new Error("Agent introuvable");
  const prefix = `CTR-${agent.matricule}`;
  const existing = await prisma.contract.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
  });
  if (existing.length === 0) return prefix;
  let i = 2;
  while (existing.some((c) => c.reference === `${prefix}-${i}`)) i++;
  return `${prefix}-${i}`;
}

// ============================================================
//  CRÉER UN CONTRAT POUR UN AGENT — DRH + DIRECTION
// ============================================================
export async function createContract(
  agentId: string,
  _prev: ContractFormState | undefined,
  formData: FormData,
): Promise<ContractFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    type: String(formData.get("type") ?? ""),
    status: String(formData.get("status") ?? ContractStatus.ACTIF),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    grade: String(formData.get("grade") ?? ""),
    baseSalary: String(formData.get("baseSalary") ?? "0"),
  };

  const parsed = ContractSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;

  // Vérifie que l'agent existe
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!agent) {
    return { errors: { _form: ["Agent introuvable."] }, values: raw };
  }

  const reference = await generateContractReference(agentId);

  const created = await prisma.contract.create({
    data: {
      agentId,
      reference,
      type: data.type,
      status: data.status,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      grade: data.grade || null,
      baseSalary: data.baseSalary,
    },
    select: { id: true },
  });

  // Scan signé joint (optionnel) — téléversé manuellement.
  const pdfFile = formData.get("pdf");
  let pdfWarning: string | null = null;
  if (pdfFile instanceof File && pdfFile.size > 0) {
    const result = await saveContractPdf({
      contractId: created.id,
      file: pdfFile,
    });
    if (result.ok) {
      await prisma.contract.update({
        where: { id: created.id },
        data: {
          pdfFilename: result.filename,
          pdfMimeType: result.mimeType,
          pdfSize: result.size,
          pdfGenerated: false,
        },
      });
    } else {
      pdfWarning = result.error;
    }
  }

  await logAudit({
    userId: me.id,
    action: "CREATE_CONTRACT",
    entity: "Contract",
    entityId: created.id,
    details: `${reference} pour ${agent.firstName} ${agent.lastName}`,
  });

  revalidatePath(`/personnel/${agentId}`);
  return {
    ok: true,
    message: pdfWarning
      ? `Contrat créé. Attention : ${pdfWarning}`
      : "Contrat créé.",
  };
}

// ============================================================
//  MODIFIER UN CONTRAT — DRH + DIRECTION
//  Modifie type/statut/dates/grade/salaire (pas la référence ni le document).
// ============================================================
export async function updateContract(
  contractId: string,
  _prev: ContractFormState | undefined,
  formData: FormData,
): Promise<ContractFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    type: String(formData.get("type") ?? ""),
    status: String(formData.get("status") ?? ContractStatus.ACTIF),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    grade: String(formData.get("grade") ?? ""),
    baseSalary: String(formData.get("baseSalary") ?? "0"),
  };

  const parsed = ContractSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, reference: true, agentId: true },
  });
  if (!contract) {
    return { errors: { _form: ["Contrat introuvable."] }, values: raw };
  }

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      type: data.type,
      status: data.status,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      grade: data.grade || null,
      baseSalary: data.baseSalary,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPDATE_CONTRACT",
    entity: "Contract",
    entityId: contractId,
    details: `${contract.reference} (${data.type} · ${data.status})`,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "Contrat mis à jour." };
}

// ============================================================
//  UPLOADER / REMPLACER LE DOCUMENT SIGNÉ D'UN CONTRAT — DRH + DIRECTION
// ============================================================
export async function uploadContractPdf(
  contractId: string,
  _prev: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Veuillez choisir un fichier." };
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, reference: true, agentId: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };

  const result = await saveContractPdf({ contractId, file });
  if (!result.ok) return result;

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      pdfFilename: result.filename,
      pdfMimeType: result.mimeType,
      pdfSize: result.size,
      // Toujours un document signé téléversé manuellement.
      pdfGenerated: false,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_CONTRACT_DOCUMENT",
    entity: "Contract",
    entityId: contractId,
    details: `${contract.reference} · ${result.filename}`,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "Document signé mis à jour." };
}

// ============================================================
//  UPLOAD DIRECT (gros fichiers jusqu'à 20 Mo) — contourne Vercel
//  1) URL signée  2) le navigateur PUT sur Supabase  3) finalisation
// ============================================================
export async function requestContractUpload(
  contractId: string,
  filename: string,
): Promise<
  { ok: true; signedUrl: string; path: string } | { ok: false; error: string }
> {
  await requireRole(Role.DIRECTION, Role.DRH);
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };

  // Un seul document par contrat → on nettoie l'ancien avant de signer.
  await deleteContractFolder(contractId);
  const clean = sanitizeFilename(filename) || "document.pdf";
  const signed = await createSignedUploadUrl(`contracts/${contractId}/${clean}`);
  return signed;
}

export async function finalizeContractUpload(
  contractId: string,
  _path: string,
  filename: string,
  size: number,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, reference: true, agentId: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };

  const clean = sanitizeFilename(filename) || "document.pdf";
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      pdfFilename: clean,
      pdfMimeType: guessMime(clean),
      pdfSize: size,
      pdfGenerated: false,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_CONTRACT_DOCUMENT",
    entity: "Contract",
    entityId: contractId,
    details: `${contract.reference} · ${clean} (${Math.round(size / 1024)} Ko)`,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "Document signé enregistré." };
}

// ============================================================
//  SUPPRIMER LE DOCUMENT SIGNÉ D'UN CONTRAT
// ============================================================
export async function deleteContractPdf(
  contractId: string,
  _prev: ContractActionState,
  _formData: FormData,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, reference: true, agentId: true, pdfFilename: true },
  });
  if (!contract) return { ok: false, error: "Contrat introuvable." };
  if (!contract.pdfFilename) {
    return { ok: false, error: "Aucun document à supprimer." };
  }

  await deleteContractFolder(contractId);
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      pdfFilename: null,
      pdfMimeType: null,
      pdfSize: null,
      pdfGenerated: false,
    },
  });

  await logAudit({
    userId: me.id,
    action: "DELETE_CONTRACT_DOCUMENT",
    entity: "Contract",
    entityId: contractId,
    details: contract.reference,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "Document supprimé." };
}
