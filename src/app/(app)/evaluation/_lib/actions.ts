"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AgentStatus, EvaluationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { canEditEvaluation } from "@/lib/evaluation-access";
import {
  EvaluationDraftSchema,
  EvaluationFinalSchema,
  type CampaignActionState,
  type EvaluationFormState,
} from "./schema";

const YEAR_RE = /^\d{4}$/;

function parseValues(formData: FormData) {
  return {
    objectives: String(formData.get("objectives") ?? ""),
    comments: String(formData.get("comments") ?? ""),
    overallScore: String(formData.get("overallScore") ?? ""),
    highPotential: formData.get("highPotential") === "on" ? "on" : "",
  };
}

// ============================================================
//  LANCER UNE CAMPAGNE D'ÉVALUATION — DIRECTION + DRH
// ============================================================
export async function launchEvaluationCampaign(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const period = String(formData.get("period") ?? "").trim();
  if (!YEAR_RE.test(period)) {
    return {
      ok: false,
      error: "Période invalide (année à 4 chiffres attendue, ex : 2026)",
    };
  }

  const year = Number(period);
  const dueDate = new Date(year, 11, 31); // 31 décembre

  // Pour chaque agent ACTIF, on prépare une évaluation s'il n'en a pas déjà une
  // pour cette période.
  const agents = await prisma.agent.findMany({
    where: { status: AgentStatus.ACTIF },
    select: {
      id: true,
      service: { select: { managerId: true } },
      evaluationsReceived: {
        where: { period },
        select: { id: true },
        take: 1,
      },
    },
  });

  const toCreate = agents
    .filter((a) => a.evaluationsReceived.length === 0)
    .map((a) => ({
      agentId: a.id,
      evaluatorId: a.service.managerId,
      period,
      status: EvaluationStatus.PLANIFIEE,
      dueDate,
    }));

  if (toCreate.length === 0) {
    return {
      ok: false,
      error: `Aucune nouvelle évaluation à créer : tous les agents actifs ont déjà une évaluation pour ${period}.`,
    };
  }

  const result = await prisma.evaluation.createMany({ data: toCreate });

  await logAudit({
    userId: me.id,
    action: "LAUNCH_EVALUATION_CAMPAIGN",
    entity: "Evaluation",
    details: `Période ${period} · ${result.count} évaluations créées`,
  });

  revalidatePath("/evaluation");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message: `${result.count} évaluation(s) créée(s) pour la campagne ${period}.`,
  };
}

// ============================================================
//  ENREGISTRER UN BROUILLON — Évaluateur désigné (ou DRH)
// ============================================================
export async function saveDraftEvaluation(
  evaluationId: string,
  _prev: EvaluationFormState,
  formData: FormData,
): Promise<EvaluationFormState> {
  const me = await getCurrentUser();

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: { id: true, evaluatorId: true, status: true, agentId: true },
  });
  if (!evaluation) {
    return { errors: { _form: ["Évaluation introuvable."] } };
  }

  const allowed = await canEditEvaluation({
    evaluatorId: evaluation.evaluatorId,
    status: evaluation.status,
  });
  if (!allowed) {
    return {
      errors: { _form: ["Vous n'êtes pas autorisé(e) à modifier cette évaluation."] },
    };
  }

  const raw = parseValues(formData);
  const parsed = EvaluationDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { ...raw, overallScore: raw.overallScore },
    };
  }

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      objectives: parsed.data.objectives || null,
      comments: parsed.data.comments || null,
      overallScore: parsed.data.overallScore ?? null,
      highPotential: parsed.data.highPotential ?? false,
      status: EvaluationStatus.EN_COURS,
    },
  });

  await logAudit({
    userId: me.id,
    action: "SAVE_DRAFT_EVALUATION",
    entity: "Evaluation",
    entityId: evaluationId,
  });

  revalidatePath("/evaluation");
  revalidatePath(`/evaluation/${evaluationId}`);
  return { ok: true, message: "Brouillon enregistré." };
}

// ============================================================
//  FINALISER UNE ÉVALUATION — Évaluateur désigné (ou DRH)
// ============================================================
export async function finalizeEvaluation(
  evaluationId: string,
  _prev: EvaluationFormState,
  formData: FormData,
): Promise<EvaluationFormState> {
  const me = await getCurrentUser();

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: {
      id: true,
      evaluatorId: true,
      status: true,
      agent: { select: { firstName: true, lastName: true } },
    },
  });
  if (!evaluation) {
    return { errors: { _form: ["Évaluation introuvable."] } };
  }

  const allowed = await canEditEvaluation({
    evaluatorId: evaluation.evaluatorId,
    status: evaluation.status,
  });
  if (!allowed) {
    return {
      errors: { _form: ["Vous n'êtes pas autorisé(e) à finaliser cette évaluation."] },
    };
  }

  const raw = parseValues(formData);
  const parsed = EvaluationFinalSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { ...raw, overallScore: raw.overallScore },
    };
  }

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      objectives: parsed.data.objectives || null,
      comments: parsed.data.comments || null,
      overallScore: parsed.data.overallScore,
      highPotential: parsed.data.highPotential ?? false,
      status: EvaluationStatus.TERMINEE,
      completedAt: new Date(),
    },
  });

  await logAudit({
    userId: me.id,
    action: "FINALIZE_EVALUATION",
    entity: "Evaluation",
    entityId: evaluationId,
    details: `${evaluation.agent.firstName} ${evaluation.agent.lastName} · note=${parsed.data.overallScore}/20`,
  });

  revalidatePath("/evaluation");
  revalidatePath(`/evaluation/${evaluationId}`);
  revalidatePath("/tableau-de-bord");
  redirect(`/evaluation/${evaluationId}?finalized=1`);
}

// ============================================================
//  RÉ-OUVRIR UNE ÉVALUATION TERMINÉE — DRH / DIRECTION uniquement
// ============================================================
export async function reopenEvaluation(
  evaluationId: string,
  _prev: CampaignActionState,
  _formData: FormData,
): Promise<CampaignActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: { id: true, status: true },
  });
  if (!evaluation) return { ok: false, error: "Évaluation introuvable." };

  if (evaluation.status !== EvaluationStatus.TERMINEE) {
    return {
      ok: false,
      error: "Seule une évaluation terminée peut être ré-ouverte.",
    };
  }

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: { status: EvaluationStatus.EN_COURS, completedAt: null },
  });

  await logAudit({
    userId: me.id,
    action: "REOPEN_EVALUATION",
    entity: "Evaluation",
    entityId: evaluationId,
  });

  revalidatePath("/evaluation");
  revalidatePath(`/evaluation/${evaluationId}`);
  return { ok: true, message: "Évaluation ré-ouverte." };
}
