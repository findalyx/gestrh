"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EsgReportStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { ESG_METRICS } from "./registry";
import { computeEsgAuto } from "./compute";
import { quarterInfo } from "./periods";

export type EsgActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

async function getUsdRate(): Promise<number | null> {
  const org = await prisma.organization.findFirst({ select: { usdRate: true } });
  return org?.usdRate ?? null;
}

// Pré-remplit (ou rafraîchit) les indicateurs auto d'un rapport.
async function fillAutoAnswers(reportId: string): Promise<number> {
  const report = await prisma.esgReport.findUnique({
    where: { id: reportId },
    select: { startDate: true, endDate: true },
  });
  if (!report) return 0;
  const usdRate = await getUsdRate();
  const computed = await computeEsgAuto(
    report.startDate,
    report.endDate,
    usdRate,
  );
  let n = 0;
  for (const m of ESG_METRICS) {
    if (!m.auto) continue;
    const value = computed[m.auto] ?? "";
    await prisma.esgAnswer.upsert({
      where: { reportId_metricKey: { reportId, metricKey: m.key } },
      create: { reportId, metricKey: m.key, value },
      update: { value },
    });
    n++;
  }
  return n;
}

// ============================================================
//  CRÉER UN RAPPORT TRIMESTRIEL
// ============================================================
export async function createEsgReport(
  _prev: EsgActionState,
  formData: FormData,
): Promise<EsgActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);

  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const q = Number.parseInt(String(formData.get("quarter") ?? ""), 10);
  if (!Number.isFinite(year) || q < 1 || q > 4) {
    return { ok: false, error: "Trimestre invalide." };
  }
  const info = quarterInfo(year, q);

  const clash = await prisma.esgReport.findUnique({
    where: { period: info.period },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, error: `Un rapport existe déjà pour ${info.label}.` };
  }

  const created = await prisma.esgReport.create({
    data: {
      period: info.period,
      label: info.label,
      startDate: info.startDate,
      endDate: info.endDate,
    },
    select: { id: true },
  });

  await fillAutoAnswers(created.id);

  await logAudit({
    userId: me.id,
    action: "CREATE_ESG_REPORT",
    entity: "EsgReport",
    entityId: created.id,
    details: info.label,
  });

  revalidatePath("/esg");
  redirect(`/esg/${created.id}`);
}

// ============================================================
//  ENREGISTRER LES RÉPONSES (sauvegarde globale du formulaire)
// ============================================================
export async function saveEsgAnswers(
  reportId: string,
  _prev: EsgActionState,
  formData: FormData,
): Promise<EsgActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);

  const report = await prisma.esgReport.findUnique({
    where: { id: reportId },
    select: { id: true, label: true },
  });
  if (!report) return { ok: false, error: "Rapport introuvable." };

  // Les % dérivés ne sont pas stockés (calculés à l'affichage).
  const storable = ESG_METRICS.filter((m) => !m.derived);

  await prisma.$transaction(
    storable.map((m) => {
      const value = String(formData.get(`v_${m.key}`) ?? "").trim();
      const comment = String(formData.get(`c_${m.key}`) ?? "").trim();
      return prisma.esgAnswer.upsert({
        where: { reportId_metricKey: { reportId, metricKey: m.key } },
        create: { reportId, metricKey: m.key, value, comment },
        update: { value, comment },
      });
    }),
  );

  await logAudit({
    userId: me.id,
    action: "UPDATE_ESG_REPORT",
    entity: "EsgReport",
    entityId: reportId,
    details: report.label,
  });

  revalidatePath(`/esg/${reportId}`);
  return { ok: true, message: "Rapport enregistré." };
}

// ============================================================
//  RAFRAÎCHIR LES DONNÉES AUTO (recalcul RH)
// ============================================================
export async function refreshEsgAuto(
  reportId: string,
  _prev: EsgActionState,
  _formData: FormData,
): Promise<EsgActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);

  const n = await fillAutoAnswers(reportId);
  if (n === 0) return { ok: false, error: "Rapport introuvable." };

  await logAudit({
    userId: me.id,
    action: "REFRESH_ESG_AUTO",
    entity: "EsgReport",
    entityId: reportId,
    details: `${n} indicateurs recalculés`,
  });

  revalidatePath(`/esg/${reportId}`);
  return { ok: true, message: "Données RH recalculées." };
}

// ============================================================
//  FINALISER / RÉOUVRIR
// ============================================================
export async function setEsgStatus(
  reportId: string,
  status: EsgReportStatus,
  _prev: EsgActionState,
  _formData: FormData,
): Promise<EsgActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);

  await prisma.esgReport.update({ where: { id: reportId }, data: { status } });

  await logAudit({
    userId: me.id,
    action: status === EsgReportStatus.FINALISE ? "FINALIZE_ESG" : "REOPEN_ESG",
    entity: "EsgReport",
    entityId: reportId,
  });

  revalidatePath(`/esg/${reportId}`);
  revalidatePath("/esg");
  return {
    ok: true,
    message:
      status === EsgReportStatus.FINALISE
        ? "Rapport finalisé."
        : "Rapport rouvert.",
  };
}

// ============================================================
//  SUPPRIMER UN RAPPORT
// ============================================================
export async function deleteEsgReport(
  reportId: string,
  _prev: EsgActionState,
  _formData: FormData,
): Promise<EsgActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH, Role.DOYEN);

  const report = await prisma.esgReport.findUnique({
    where: { id: reportId },
    select: { label: true },
  });
  if (!report) return { ok: false, error: "Rapport introuvable." };

  await prisma.esgReport.delete({ where: { id: reportId } });

  await logAudit({
    userId: me.id,
    action: "DELETE_ESG_REPORT",
    entity: "EsgReport",
    entityId: reportId,
    details: report.label,
  });

  revalidatePath("/esg");
  redirect("/esg");
}
