"use server";

import { revalidatePath } from "next/cache";
import { PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { putObject, sanitizeFilename } from "@/lib/supabase-storage";
import { parsePayslips } from "@/lib/payslip-parse";

const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo (PDF multi-bulletins)

export type ImportPayslipsState =
  | {
      ok: true;
      imported: number;
      updated: number;
      period: string | null;
      unmatched: { matricule: string | null; name: string | null }[];
      skipped: number;
    }
  | { ok: false; error: string }
  | undefined;

export async function importPayslips(
  _prev: ImportPayslipsState,
  formData: FormData,
): Promise<ImportPayslipsState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Veuillez choisir un fichier PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).` };
  }
  if (file.type && file.type !== "application/pdf") {
    return { ok: false, error: "Le fichier doit être un PDF." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parsePayslips(buffer);
  } catch (e) {
    console.error("[importPayslips] parse error:", e);
    return { ok: false, error: "Impossible de lire ce PDF (format non reconnu)." };
  }

  // Période dominante (pour l'archivage + le résumé)
  const periodCounts = new Map<string, number>();
  for (const p of parsed) {
    if (p.period) periodCounts.set(p.period, (periodCounts.get(p.period) ?? 0) + 1);
  }
  const dominantPeriod =
    [...periodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Archive le PDF source sur Supabase
  await putObject({
    path: `payslips/${dominantPeriod ?? "import"}/${sanitizeFilename(file.name)}`,
    buffer,
    contentType: "application/pdf",
    upsert: true,
  });

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const unmatched: { matricule: string | null; name: string | null }[] = [];

  for (const p of parsed) {
    if (!p.matricule || p.net == null || !p.period) {
      skipped++;
      continue;
    }
    const agent = await prisma.agent.findUnique({
      where: { matricule: p.matricule },
      select: { id: true },
    });
    if (!agent) {
      unmatched.push({ matricule: p.matricule, name: p.name });
      continue;
    }
    const brut = p.brut ?? p.net;
    const deductions = Math.max(0, brut - p.net);

    const existing = await prisma.payrollRecord.findUnique({
      where: { agentId_period: { agentId: agent.id, period: p.period } },
      select: { id: true },
    });
    await prisma.payrollRecord.upsert({
      where: { agentId_period: { agentId: agent.id, period: p.period } },
      create: {
        agentId: agent.id,
        period: p.period,
        baseSalary: brut,
        deductions,
        netSalary: p.net,
        status: PayrollStatus.PAYE,
      },
      update: {
        baseSalary: brut,
        deductions,
        netSalary: p.net,
        status: PayrollStatus.PAYE,
      },
    });
    if (existing) updated++;
    else imported++;
  }

  await logAudit({
    userId: me.id,
    action: "IMPORT_PAYSLIPS",
    entity: "PayrollRecord",
    details: `${file.name} · période ${dominantPeriod ?? "?"} · ${imported} créés, ${updated} maj, ${unmatched.length} non reliés`,
  });

  revalidatePath("/paie");
  revalidatePath("/tableau-de-bord");

  return {
    ok: true,
    imported,
    updated,
    period: dominantPeriod,
    unmatched,
    skipped,
  };
}
