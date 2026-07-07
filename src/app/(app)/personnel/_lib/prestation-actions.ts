"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, PrestationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { savePrestationDocument } from "@/lib/prestation-storage";

// Période au format YYYY-MM
const periodString = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Période invalide (attendu AAAA-MM)");

const PrestationSchema = z.object({
  period: periodString,
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().int().min(1, "Montant requis").max(50_000_000),
  ),
  label: z.string().trim().max(120).optional().or(z.literal("")),
});

export type PrestationFormState = {
  errors?: Partial<
    Record<"period" | "amount" | "label" | "_form", string[]>
  >;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

export type PrestationActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// ============================================================
//  CRÉER UNE PRESTATION MENSUELLE — DRH + DIRECTION
//  Optionnellement avec le document signé joint dès la création.
// ============================================================
export async function createPrestationInvoice(
  agentId: string,
  _prev: PrestationFormState | undefined,
  formData: FormData,
): Promise<PrestationFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    period: String(formData.get("period") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    label: String(formData.get("label") ?? ""),
  };
  const parsed = PrestationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, firstName: true, lastName: true, category: true },
  });
  if (!agent) {
    return { errors: { _form: ["Agent introuvable."] }, values: raw };
  }

  // Document signé (optionnel)
  const docFile = formData.get("document");
  let docFields: {
    documentName: string;
    documentPath: string;
    documentSize: number;
  } | null = null;
  let docWarning: string | null = null;
  if (docFile instanceof File && docFile.size > 0) {
    const saved = await savePrestationDocument({
      agentId,
      period: data.period,
      file: docFile,
    });
    if (saved.ok) {
      docFields = {
        documentName: saved.filename,
        documentPath: saved.path,
        documentSize: saved.size,
      };
    } else {
      docWarning = saved.error;
    }
  }

  try {
    await prisma.prestationInvoice.create({
      data: {
        agentId,
        period: data.period,
        amount: data.amount,
        label: data.label || null,
        status: docFields ? PrestationStatus.SIGNE : PrestationStatus.EN_ATTENTE,
        ...(docFields ?? {}),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        errors: {
          period: ["Une prestation existe déjà pour ce prestataire et ce mois."],
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
    details: `${agent.firstName} ${agent.lastName} · ${data.period} · ${data.amount} FCFA`,
  });

  revalidatePath(`/personnel/${agentId}`);
  return {
    ok: true,
    message: docWarning
      ? `Prestation créée. Document non joint : ${docWarning}`
      : "Prestation enregistrée.",
  };
}

// ============================================================
//  MODIFIER MONTANT / LIBELLÉ D'UNE PRESTATION — DRH + DIRECTION
// ============================================================
export async function updatePrestationInvoice(
  invoiceId: string,
  _prev: PrestationFormState | undefined,
  formData: FormData,
): Promise<PrestationFormState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const raw = {
    period: String(formData.get("period") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    label: String(formData.get("label") ?? ""),
  };
  const parsed = PrestationSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;

  const invoice = await prisma.prestationInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, agentId: true },
  });
  if (!invoice) {
    return { errors: { _form: ["Prestation introuvable."] }, values: raw };
  }

  await prisma.prestationInvoice.update({
    where: { id: invoiceId },
    data: {
      period: data.period,
      amount: data.amount,
      label: data.label || null,
    },
  });

  await logAudit({
    userId: me.id,
    action: "UPDATE_PRESTATION",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: `${data.period} · ${data.amount} FCFA`,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Prestation mise à jour." };
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
  if (!invoice) return { ok: false, error: "Prestation introuvable." };

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
      // Recevoir le document signé fait passer au statut SIGNE (sauf déjà payé).
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
  if (!invoice) return { ok: false, error: "Prestation introuvable." };

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
//  SUPPRIMER UNE PRESTATION — DRH + DIRECTION
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
  if (!invoice) return { ok: false, error: "Prestation introuvable." };

  await prisma.prestationInvoice.delete({ where: { id: invoiceId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_PRESTATION",
    entity: "PrestationInvoice",
    entityId: invoiceId,
    details: invoice.period,
  });

  revalidatePath(`/personnel/${invoice.agentId}`);
  return { ok: true, message: "Prestation supprimée." };
}
