"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Gender, Prisma, PrestationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { getOrganization } from "@/lib/organization";
import {
  savePrestationDocument,
  savePrestationBuffer,
} from "@/lib/prestation-storage";
import { buildHonorairesNoteDocx } from "@/lib/docx/honoraires-note";

// Taux de retenue à la source sur honoraires (BRS Sénégal, résidents).
const WITHHOLDING_RATE = 0.05;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Référence automatique d'une note d'honoraires : {matricule}/{MM}-{YYYY}.
 * Ex : matricule 3146, période "2026-06" → "3146/06-2026".
 * NB : fonction locale (non exportée) — dans un fichier "use server", tout
 * export doit être une Server Action async.
 */
function defaultReference(matricule: string, period: string): string {
  const [year, month] = period.split("-");
  return `${matricule}/${month}-${year}`;
}

const periodString = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Période invalide (attendu AAAA-MM)");

const dateString = z
  .string()
  .trim()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Date invalide");

const PrestationSchema = z.object({
  period: periodString,
  grossAmount: z.preprocess(
    // Retire les séparateurs de milliers (espaces, insécables, points) avant conversion.
    (v) => {
      const digits = String(v ?? "").replace(/\D/g, "");
      return digits === "" ? 0 : Number(digits);
    },
    z.number().int().min(1, "Montant brut requis").max(50_000_000),
  ),
  designation: z.string().trim().max(160).optional().or(z.literal("")),
  reference: z.string().trim().max(40).optional().or(z.literal("")),
  noteDate: dateString.optional().or(z.literal("")),
});

export type PrestationFormState = {
  errors?: Partial<
    Record<
      "period" | "grossAmount" | "designation" | "reference" | "noteDate" | "_form",
      string[]
    >
  >;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

export type PrestationActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

/** Calcule retenue (5%) et net à partir du brut. */
function computeAmounts(gross: number): { withholding: number; net: number } {
  const withholding = Math.round(gross * WITHHOLDING_RATE);
  return { withholding, net: gross - withholding };
}

// ============================================================
//  CRÉER UNE NOTE D'HONORAIRES — DRH + DIRECTION
// ============================================================
export async function createPrestationInvoice(
  agentId: string,
  _prev: PrestationFormState | undefined,
  formData: FormData,
): Promise<PrestationFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    period: String(formData.get("period") ?? ""),
    grossAmount: String(formData.get("grossAmount") ?? ""),
    designation: String(formData.get("designation") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    noteDate: String(formData.get("noteDate") ?? ""),
  };
  const parsed = PrestationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;
  const { withholding, net } = computeAmounts(data.grossAmount);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, firstName: true, lastName: true, matricule: true },
  });
  if (!agent) {
    return { errors: { _form: ["Agent introuvable."] }, values: raw };
  }

  // Référence : saisie manuelle si fournie, sinon auto {matricule}/{MM}-{YYYY}
  const reference = data.reference || defaultReference(agent.matricule, data.period);

  try {
    await prisma.prestationInvoice.create({
      data: {
        agentId,
        period: data.period,
        reference,
        designation: data.designation || null,
        grossAmount: data.grossAmount,
        withholding,
        amount: net,
        noteDate: data.noteDate ? new Date(data.noteDate) : null,
        status: PrestationStatus.EN_ATTENTE,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        errors: {
          period: ["Une note existe déjà pour ce prestataire et ce mois."],
        },
        values: raw,
      };
    }
    throw e;
  }

  await logAudit({
    userId: me.id,
    action: "CREATE_PRESTATION",
    entity: "PrestationInvoice",
    details: `${agent.firstName} ${agent.lastName} · ${data.period} · brut ${data.grossAmount} / net ${net} FCFA`,
  });

  revalidatePath(`/personnel/${agentId}`);
  return { ok: true, message: "Note d'honoraires enregistrée." };
}

// ============================================================
//  MODIFIER UNE NOTE — DRH + DIRECTION
// ============================================================
export async function updatePrestationInvoice(
  invoiceId: string,
  _prev: PrestationFormState | undefined,
  formData: FormData,
): Promise<PrestationFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    period: String(formData.get("period") ?? ""),
    grossAmount: String(formData.get("grossAmount") ?? ""),
    designation: String(formData.get("designation") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    noteDate: String(formData.get("noteDate") ?? ""),
  };
  const parsed = PrestationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;
  const { withholding, net } = computeAmounts(data.grossAmount);

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, agentId: true },
  });
  if (!invoice) {
    return { errors: { _form: ["Note introuvable."] }, values: raw };
  }

  await prisma.prestationInvoice.update({
    where: { id: invoiceId },
    data: {
      period: data.period,
      reference: data.reference || null,
      designation: data.designation || null,
      grossAmount: data.grossAmount,
      withholding,
      amount: net,
      noteDate: data.noteDate ? new Date(data.noteDate) : null,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPDATE_PRESTATION",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: `${data.period} · net ${net} FCFA`,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Note mise à jour." };
}

// ============================================================
//  GÉNÉRER LA NOTE D'HONORAIRES (WORD) — DRH + DIRECTION
//  Produit un .docx au format SCIMD (avec papier en-tête) et le stocke.
//  Le document peut être téléchargé, signé, puis re-téléversé.
// ============================================================
export async function generateHonorairesNote(
  invoiceId: string,
  _prev: PrestationActionState,
  _formData: FormData,
): Promise<PrestationActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          gender: true,
          jobTitle: true,
          matricule: true,
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Note introuvable." };

  const org = await getOrganization();

  const civility = invoice.agent.gender === Gender.FEMME ? "Madame" : "Monsieur";
  const fullName = `${invoice.agent.lastName.toUpperCase()} ${invoice.agent.firstName}`;
  const reference =
    invoice.reference || defaultReference(invoice.agent.matricule, invoice.period);

  try {
    const bytes = await buildHonorairesNoteDocx({
      organization: {
        name: org.name,
        shortName: org.shortName,
        city: org.city,
        bp: org.bp,
        address: org.address,
      },
      beneficiary: { civility, fullName },
      note: {
        reference,
        date: invoice.noteDate ?? new Date(),
        designation: invoice.designation || invoice.agent.jobTitle,
        grossAmount: invoice.grossAmount,
        withholding: invoice.withholding,
        netAmount: invoice.amount,
      },
    });
    const buffer = Buffer.from(bytes);

    const filename = `note-honoraires-${invoice.period}.docx`;
    const saved = await savePrestationBuffer({
      agentId: invoice.agentId,
      period: invoice.period,
      filename,
      buffer,
      contentType: DOCX_MIME,
    });
    if (!saved.ok) return { ok: false, error: saved.error };

    await prisma.prestationInvoice.update({
      where: { id: invoiceId },
      data: {
        documentName: saved.filename,
        documentPath: saved.path,
        documentSize: buffer.length,
        documentGenerated: true,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generateHonorairesNote] échec:", e);
    return { ok: false, error: `Échec de la génération : ${msg.slice(0, 150)}` };
  }

  await logAudit({
    userId: me.id,
    action: "GENERATE_HONORAIRES",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: `${invoice.period} · ${fullName}`,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Note d'honoraires générée (Word)." };
}

// ============================================================
//  JOINDRE / REMPLACER LE DOCUMENT SIGNÉ — DRH + DIRECTION
// ============================================================
export async function uploadPrestationDocument(
  invoiceId: string,
  _prev: PrestationActionState,
  formData: FormData,
): Promise<PrestationActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Veuillez choisir un fichier." };
  }

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, agentId: true, period: true, status: true },
  });
  if (!invoice) return { ok: false, error: "Note introuvable." };

  const saved = await savePrestationDocument({
    agentId: invoice.agentId,
    period: invoice.period,
    file,
  });
  if (!saved.ok) return { ok: false, error: saved.error };

  await prisma.prestationInvoice.update({
    where: { id: invoiceId },
    data: {
      documentName: saved.filename,
      documentPath: saved.path,
      documentSize: saved.size,
      documentGenerated: false, // scan signé téléversé
      status:
        invoice.status === PrestationStatus.PAYE
          ? PrestationStatus.PAYE
          : PrestationStatus.SIGNE,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPLOAD_PRESTATION_DOC",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: `${invoice.period} · ${saved.filename}`,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Document signé enregistré." };
}

// ============================================================
//  CHANGER LE STATUT (SIGNÉ / PAYÉ) — DRH + DIRECTION
// ============================================================
export async function setPrestationStatus(
  invoiceId: string,
  status: PrestationStatus,
  _prev: PrestationActionState,
  _formData: FormData,
): Promise<PrestationActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, agentId: true, period: true },
  });
  if (!invoice) return { ok: false, error: "Note introuvable." };

  await prisma.prestationInvoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === PrestationStatus.PAYE ? new Date() : null,
    },
  });

  await logAudit({
    userId: me.id,
    action: "SET_PRESTATION_STATUS",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: `${invoice.period} → ${status}`,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: `Statut mis à jour : ${status}.` };
}

// ============================================================
//  SUPPRIMER UNE NOTE — DRH + DIRECTION
// ============================================================
export async function deletePrestationInvoice(
  invoiceId: string,
  _prev: PrestationActionState,
  _formData: FormData,
): Promise<PrestationActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, agentId: true, period: true },
  });
  if (!invoice) return { ok: false, error: "Note introuvable." };

  await prisma.prestationInvoice.delete({ where: { id: invoiceId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_PRESTATION",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: invoice.period,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Note supprimée." };
}
