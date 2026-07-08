"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AgentStatus, ContractStatus, PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { computeNetSalary } from "@/lib/payroll-access";
import { removeObject, removePrefix } from "@/lib/supabase-storage";

export type PayrollActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// ============================================================
//  GÉNÉRER LES BULLETINS DU MOIS — DIRECTION + DRH
// ============================================================
export async function generateMonthlyPayroll(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const period = String(formData.get("period") ?? "").trim();
  if (!PERIOD_RE.test(period)) {
    return { ok: false, error: "Période invalide (format attendu : AAAA-MM)" };
  }

  // Empêcher la régénération si la période a déjà des bulletins
  const existing = await prisma.payrollRecord.count({ where: { period } });
  if (existing > 0) {
    return {
      ok: false,
      error: `${existing} bulletin(s) existent déjà pour ${period}. Supprimez-les avant de relancer.`,
    };
  }

  // Pour chaque agent ACTIF, récupère son contrat actif (le plus récent)
  const agents = await prisma.agent.findMany({
    where: {
      status: AgentStatus.ACTIF,
      contracts: { some: { status: ContractStatus.ACTIF } },
    },
    select: {
      id: true,
      contracts: {
        where: { status: ContractStatus.ACTIF },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { baseSalary: true },
      },
    },
  });

  const data = agents
    .filter((a) => a.contracts.length > 0)
    .map((a) => {
      const baseSalary = a.contracts[0].baseSalary;
      const { net } = computeNetSalary({
        baseSalary,
        bonuses: 0,
        allowances: 0,
        deductions: 0,
      });
      return {
        agentId: a.id,
        period,
        baseSalary,
        bonuses: 0,
        allowances: 0,
        deductions: baseSalary - net, // = cotisations
        netSalary: net,
        status: PayrollStatus.BROUILLON,
      };
    });

  if (data.length === 0) {
    return {
      ok: false,
      error: "Aucun agent actif avec contrat actif. Rien à générer.",
    };
  }

  const result = await prisma.payrollRecord.createMany({ data });

  await logAudit({
    userId: me.id,
    action: "GENERATE_PAYROLL_BATCH",
    entity: "PayrollRecord",
    details: `Période ${period} · ${result.count} bulletins (BROUILLON)`,
  });

  revalidatePath("/paie");
  revalidatePath("/tableau-de-bord");
  // Redirige vers la période fraîchement créée pour la voir tout de suite.
  redirect(`/paie?period=${encodeURIComponent(period)}&generated=${result.count}`);
}

// ============================================================
//  VALIDER UN BULLETIN (BROUILLON → VALIDE) — DRH
// ============================================================
export async function validatePayroll(
  payrollId: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const record = await prisma.payrollRecord.findUnique({
    where: { id: payrollId },
    include: { agent: { select: { firstName: true, lastName: true, matricule: true } } },
  });
  if (!record) return { ok: false, error: "Bulletin introuvable." };

  if (record.status !== PayrollStatus.BROUILLON) {
    return { ok: false, error: "Seul un bulletin en brouillon peut être validé." };
  }

  await prisma.payrollRecord.update({
    where: { id: payrollId },
    data: { status: PayrollStatus.VALIDE },
  });

  await logAudit({
    userId: me.id,
    action: "VALIDATE_PAYROLL",
    entity: "PayrollRecord",
    entityId: payrollId,
    details: `${record.agent.matricule} · ${record.period}`,
  });

  revalidatePath("/paie");
  revalidatePath(`/paie/${payrollId}`);
  return { ok: true, message: "Bulletin validé." };
}

// ============================================================
//  MARQUER UN BULLETIN PAYÉ (VALIDE → PAYE) — DRH
// ============================================================
export async function markPayrollPaid(
  payrollId: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const record = await prisma.payrollRecord.findUnique({
    where: { id: payrollId },
    include: { agent: { select: { matricule: true } } },
  });
  if (!record) return { ok: false, error: "Bulletin introuvable." };

  if (record.status !== PayrollStatus.VALIDE) {
    return {
      ok: false,
      error: "Le bulletin doit être validé avant d'être marqué payé.",
    };
  }

  await prisma.payrollRecord.update({
    where: { id: payrollId },
    data: { status: PayrollStatus.PAYE },
  });

  await logAudit({
    userId: me.id,
    action: "MARK_PAYROLL_PAID",
    entity: "PayrollRecord",
    entityId: payrollId,
    details: `${record.agent.matricule} · ${record.period}`,
  });

  revalidatePath("/paie");
  revalidatePath(`/paie/${payrollId}`);
  return { ok: true, message: "Bulletin marqué comme payé." };
}

// ============================================================
//  VALIDER TOUTE UNE PÉRIODE (batch) — DRH
// ============================================================
export async function validatePeriodBatch(
  period: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  if (!PERIOD_RE.test(period)) {
    return { ok: false, error: "Période invalide." };
  }

  const result = await prisma.payrollRecord.updateMany({
    where: { period, status: PayrollStatus.BROUILLON },
    data: { status: PayrollStatus.VALIDE },
  });

  await logAudit({
    userId: me.id,
    action: "VALIDATE_PAYROLL_BATCH",
    entity: "PayrollRecord",
    details: `Période ${period} · ${result.count} bulletins validés`,
  });

  revalidatePath("/paie");
  return {
    ok: true,
    message: `${result.count} bulletin(s) validé(s) pour ${period}.`,
  };
}

// ============================================================
//  MARQUER TOUTE UNE PÉRIODE COMME PAYÉE (batch) — DRH
// ============================================================
export async function markPeriodPaidBatch(
  period: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  if (!PERIOD_RE.test(period)) {
    return { ok: false, error: "Période invalide." };
  }

  const result = await prisma.payrollRecord.updateMany({
    where: { period, status: PayrollStatus.VALIDE },
    data: { status: PayrollStatus.PAYE },
  });

  if (result.count === 0) {
    return {
      ok: false,
      error: "Aucun bulletin validé à marquer payé sur cette période.",
    };
  }

  await logAudit({
    userId: me.id,
    action: "MARK_PAYROLL_PAID_BATCH",
    entity: "PayrollRecord",
    details: `Période ${period} · ${result.count} bulletins marqués payés`,
  });

  revalidatePath("/paie");
  return {
    ok: true,
    message: `${result.count} bulletin(s) marqué(s) comme payé(s) pour ${period}.`,
  };
}

// ============================================================
//  SUPPRIMER UN BULLETIN — DIRECTION + DRH
//  Retire aussi le PDF individuel sur Supabase Storage.
// ============================================================
export async function deletePayrollRecord(
  recordId: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const record = await prisma.payrollRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      period: true,
      pdfUrl: true,
      agent: { select: { firstName: true, lastName: true, matricule: true } },
    },
  });
  if (!record) return { ok: false, error: "Bulletin introuvable." };

  if (record.pdfUrl) {
    await removeObject(record.pdfUrl);
  }
  await prisma.payrollRecord.delete({ where: { id: recordId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_PAYROLL_RECORD",
    entity: "PayrollRecord",
    entityId: recordId,
    details: `${record.agent.lastName} ${record.agent.firstName} (${record.agent.matricule}) · ${record.period}`,
  });

  revalidatePath("/paie");
  revalidatePath("/tableau-de-bord");
  return { ok: true, message: "Bulletin supprimé." };
}

// ============================================================
//  SUPPRIMER TOUS LES BULLETINS D'UNE PÉRIODE — DIRECTION + DRH
//  Purge les PDF individuels + le PDF source archivé de la période.
//  Utile pour corriger un import partiel avant de ré-importer.
// ============================================================
export async function deletePeriodPayroll(
  period: string,
  _prev: PayrollActionState,
  _formData: FormData,
): Promise<PayrollActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  if (!PERIOD_RE.test(period)) {
    return { ok: false, error: "Période invalide." };
  }

  const records = await prisma.payrollRecord.findMany({
    where: { period },
    select: { id: true, pdfUrl: true },
  });
  if (records.length === 0) {
    return { ok: false, error: "Aucun bulletin sur cette période." };
  }

  // Supprime les fichiers : PDF individuels + tout le dossier de la période
  // (inclut le PDF source archivé lors de l'import).
  await removePrefix(`payslips/${period}`);

  const result = await prisma.payrollRecord.deleteMany({ where: { period } });

  await logAudit({
    userId: me.id,
    action: "DELETE_PAYROLL_PERIOD",
    entity: "PayrollRecord",
    details: `Période ${period} · ${result.count} bulletins supprimés`,
  });

  revalidatePath("/paie");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message: `${result.count} bulletin(s) supprimé(s) pour ${period}.`,
  };
}
