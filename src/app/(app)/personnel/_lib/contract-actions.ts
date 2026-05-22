"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContractStatus, ContractType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  deleteContractFolder,
  saveContractPdf,
} from "@/lib/contract-storage";
import { generateContractPdf } from "@/lib/contract-pdf";
import { getOrganization } from "@/lib/organization";

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

  // PDF joint (optionnel) — considéré comme un scan signé téléversé manuellement.
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
//  Modifie type/statut/dates/grade/salaire (pas la référence ni le PDF).
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
//  UPLOADER / REMPLACER LE PDF D'UN CONTRAT — DRH + DIRECTION
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
      // Upload manuel = scan signé. À NE PAS écraser par les régénérations bulk.
      pdfGenerated: false,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_CONTRACT_PDF",
    entity: "Contract",
    entityId: contractId,
    details: `${contract.reference} · ${result.filename}`,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "PDF du contrat mis à jour." };
}

// ============================================================
//  HELPER : génère et persiste un PDF auto pour un contrat
//  Renvoie { ok: true } ou { ok: false, error }
// ============================================================
const CONTRACT_PDF_ROOT = path.join(process.cwd(), "uploads", "contracts");

type ContractWithAgent = NonNullable<
  Awaited<ReturnType<typeof loadContractForPdf>>
>;

async function loadContractForPdf(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          jobTitle: true,
          address: true,
          birthDate: true,
          birthPlace: true,
          nationality: true,
          maritalStatus: true,
          service: { select: { name: true } },
        },
      },
    },
  });
}

async function renderAndPersistContractPdf(
  c: ContractWithAgent,
  org: Awaited<ReturnType<typeof getOrganization>>,
): Promise<void> {
  const buffer = await generateContractPdf({
    organization: {
      name: org.name,
      shortName: org.shortName,
      address: org.address,
      city: org.city,
      country: org.country,
      ninea: org.ninea,
      rccm: org.rccm,
      phone: org.phone,
      bp: org.bp,
      capital: org.capital,
      legalRepName: org.legalRepName,
      legalRepTitle: org.legalRepTitle,
    },
    agent: {
      firstName: c.agent.firstName,
      lastName: c.agent.lastName,
      matricule: c.agent.matricule,
      jobTitle: c.agent.jobTitle,
      address: c.agent.address,
      birthDate: c.agent.birthDate,
      birthPlace: c.agent.birthPlace,
      nationality: c.agent.nationality,
      maritalStatus: c.agent.maritalStatus,
      serviceName: c.agent.service.name,
    },
    contract: {
      reference: c.reference,
      type: c.type,
      startDate: c.startDate,
      endDate: c.endDate,
      grade: c.grade,
      baseSalary: c.baseSalary,
    },
  });

  const filename = `${c.reference}.pdf`;
  const dir = path.join(CONTRACT_PDF_ROOT, c.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  await prisma.contract.update({
    where: { id: c.id },
    data: {
      pdfFilename: filename,
      pdfMimeType: "application/pdf",
      pdfSize: buffer.length,
      pdfGenerated: true,
    },
  });
}

// ============================================================
//  GÉNÉRER LES PDF DES CONTRATS QUI N'EN ONT PAS — DRH + DIRECTION
//  Ne touche pas aux contrats déjà munis d'un PDF (généré ou scan signé).
// ============================================================
export async function generateMissingContractPdfs(
  _prev: ContractActionState,
  _formData: FormData,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const org = await getOrganization();
  const contracts = await prisma.contract.findMany({
    where: { pdfFilename: null },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          jobTitle: true,
          address: true,
          birthDate: true,
          birthPlace: true,
          nationality: true,
          maritalStatus: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  if (contracts.length === 0) {
    return { ok: false, error: "Tous les contrats ont déjà un PDF joint." };
  }

  let generated = 0;
  const firstErrors: string[] = [];
  for (const c of contracts) {
    try {
      await renderAndPersistContractPdf(c, org);
      generated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[generateMissingContractPdfs] échec sur ${c.reference} :`,
        e,
      );
      if (firstErrors.length < 3) firstErrors.push(`${c.reference} : ${msg}`);
    }
  }

  await logAudit({
    userId: me.id,
    action: "GENERATE_CONTRACT_PDFS_BATCH",
    entity: "Contract",
    details: `${generated} PDF(s) générés sur ${contracts.length} contrat(s) sans PDF`,
  });

  revalidatePath("/personnel");
  revalidatePath("/parametres");

  if (generated === 0) {
    return {
      ok: false,
      error: `Aucun PDF généré. Détail des erreurs : ${firstErrors.join(" | ")}`,
    };
  }

  return {
    ok: true,
    message: `${generated} PDF de contrat généré(s)${firstErrors.length > 0 ? ` (${firstErrors.length}+ échecs : ${firstErrors[0]})` : ""}.`,
  };
}

// ============================================================
//  RÉ-GÉNÉRER TOUS LES PDF AUTO-GÉNÉRÉS — DRH + DIRECTION
//  Écrase les PDF marqués pdfGenerated=true et génère ceux qui manquent.
//  ÉPARGNE les scans signés (pdfGenerated=false sur un contrat avec PDF).
// ============================================================
export async function regenerateAllContractPdfs(
  _prev: ContractActionState,
  _formData: FormData,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const org = await getOrganization();
  // On régénère : (PDF manquant) OU (PDF présent ET auto-généré)
  // On épargne : (PDF présent ET pdfGenerated=false) = scan signé
  const contracts = await prisma.contract.findMany({
    where: {
      OR: [{ pdfFilename: null }, { pdfGenerated: true }],
    },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          jobTitle: true,
          address: true,
          birthDate: true,
          birthPlace: true,
          nationality: true,
          maritalStatus: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  const totalContracts = await prisma.contract.count();
  const preservedCount = totalContracts - contracts.length;

  if (contracts.length === 0) {
    return {
      ok: false,
      error: `Aucun contrat à régénérer (${preservedCount} scans signés préservés).`,
    };
  }

  let regenerated = 0;
  const firstErrors: string[] = [];
  for (const c of contracts) {
    try {
      await renderAndPersistContractPdf(c, org);
      regenerated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[regenerateAllContractPdfs] échec sur ${c.reference} :`,
        e,
      );
      if (firstErrors.length < 3) firstErrors.push(`${c.reference} : ${msg}`);
    }
  }

  await logAudit({
    userId: me.id,
    action: "REGENERATE_CONTRACT_PDFS_BATCH",
    entity: "Contract",
    details: `${regenerated}/${contracts.length} PDF(s) régénérés · ${preservedCount} scan(s) signé(s) préservé(s)`,
  });

  revalidatePath("/personnel");
  revalidatePath("/parametres");

  if (regenerated === 0) {
    return {
      ok: false,
      error: `Aucun PDF généré. Erreurs : ${firstErrors.join(" | ")}`,
    };
  }

  return {
    ok: true,
    message:
      `${regenerated} PDF régénéré(s)` +
      (preservedCount > 0
        ? ` · ${preservedCount} scan(s) signé(s) préservé(s)`
        : "") +
      (firstErrors.length > 0 ? ` · ${firstErrors.length} échec(s)` : "") +
      ".",
  };
}

// ============================================================
//  GÉNÉRER / RÉGÉNÉRER LE PDF D'UN SEUL CONTRAT — DRH + DIRECTION
//  Utilisé depuis la fiche agent. Écrase systématiquement et marque
//  pdfGenerated=true.
// ============================================================
export async function generateOneContractPdf(
  contractId: string,
  _prev: ContractActionState,
  _formData: FormData,
): Promise<ContractActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const c = await loadContractForPdf(contractId);
  if (!c) return { ok: false, error: "Contrat introuvable." };

  const org = await getOrganization();
  try {
    await renderAndPersistContractPdf(c, org);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[generateOneContractPdf] échec sur ${c.reference} :`, e);
    return { ok: false, error: `Échec de la génération : ${msg}` };
  }

  await logAudit({
    userId: me.id,
    action: "GENERATE_CONTRACT_PDF",
    entity: "Contract",
    entityId: c.id,
    details: c.reference,
  });

  revalidatePath(`/personnel/${c.agentId}`);
  return { ok: true, message: "PDF du contrat généré." };
}

// ============================================================
//  SUPPRIMER LE PDF D'UN CONTRAT
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
    return { ok: false, error: "Aucun PDF à supprimer." };
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
    action: "DELETE_CONTRACT_PDF",
    entity: "Contract",
    entityId: contractId,
    details: contract.reference,
  });

  revalidatePath(`/personnel/${contract.agentId}`);
  return { ok: true, message: "PDF supprimé." };
}
