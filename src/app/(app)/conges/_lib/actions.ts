"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  LeaveDecision,
  LeaveStatus,
  LeaveType,
  NotificationType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  LeaveRequestSchema,
  calcDays,
  type LeaveFormState,
  type LeaveActionState,
} from "./schema";
import {
  buildRequestChain,
  canDecideStep,
  PENDING_LEAVE_STATUSES,
} from "./workflow";

// ============================================================
//  Notifications
// ============================================================
async function notify(
  userIds: string[],
  data: { type: NotificationType; title: string; message: string; link: string },
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, ...data })),
  });
}

/** Notifie le compte utilisateur d'un agent (s'il en a un actif). */
async function notifyAgent(
  agentId: string,
  data: { type: NotificationType; title: string; message: string; link: string },
): Promise<void> {
  const u = await prisma.user.findFirst({
    where: { agentId, isActive: true },
    select: { id: true },
  });
  if (u) await notify([u.id], data);
}

// ============================================================
//  CRÉER UNE DEMANDE — Agent (sa propre demande)
// ============================================================
export async function createLeaveRequest(
  _prev: LeaveFormState | undefined,
  formData: FormData,
): Promise<LeaveFormState> {
  const me = await getCurrentUser();
  if (!me.agent) {
    return {
      errors: {
        _form: ["Votre compte n'est pas relié à un agent. Contactez la DRH."],
      },
    };
  }

  // Les prestataires ne sont pas concernés par les congés.
  const meAgent = await prisma.agent.findUnique({
    where: { id: me.agent.id },
    select: { category: true },
  });
  if (meAgent?.category === "PRESTATAIRE") {
    return {
      errors: {
        _form: [
          "Les prestataires de services ne sont pas concernés par le module de congés.",
        ],
      },
    };
  }

  const raw = {
    type: String(formData.get("type") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };

  const parsed = LeaveRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: raw };
  }
  const data = parsed.data;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const days = calcDays(start, end);

  // Vérifie qu'aucune demande active de l'agent ne chevauche
  const overlap = await prisma.leaveRequest.count({
    where: {
      agentId: me.agent.id,
      status: { in: [LeaveStatus.AUTORISE, ...PENDING_LEAVE_STATUSES] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap > 0) {
    return {
      errors: { startDate: ["Une demande de congé chevauche déjà cette période"] },
      values: raw,
    };
  }

  const agentId = me.agent.id;

  // Le DG valide ses propres congés → auto-autorisé. Sinon, chaîne de validateurs.
  const isDg = me.role === Role.DIRECTION;
  const chain = isDg ? [] : await buildRequestChain(agentId);
  const autoAuthorized = isDg || chain.length === 0;

  const status = autoAuthorized ? LeaveStatus.AUTORISE : LeaveStatus.EN_ATTENTE;
  const currentLevel = autoAuthorized ? null : 1;
  const currentApproverAgentId = autoAuthorized ? null : chain[0].validatorAgentId;
  const year = start.getFullYear();

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.leaveRequest.create({
      data: {
        agentId,
        type: data.type as LeaveType,
        status,
        currentLevel,
        currentApproverAgentId,
        startDate: start,
        endDate: end,
        days,
        reason: data.reason || null,
      },
      select: { id: true },
    });
    if (autoAuthorized) {
      await tx.leaveBalance.upsert({
        where: {
          agentId_year_type: { agentId, year, type: data.type as LeaveType },
        },
        create: {
          agentId,
          year,
          type: data.type as LeaveType,
          totalDays: 0,
          usedDays: days,
        },
        update: { usedDays: { increment: days } },
      });
    }
    return c;
  });

  // Notifie le premier validateur de la chaîne.
  if (!autoAuthorized) {
    await notifyAgent(chain[0].validatorAgentId, {
      type: NotificationType.VALIDATION,
      title: "Nouvelle demande de congé à valider",
      message: `${me.agent.firstName} ${me.agent.lastName} · ${data.type} · ${days}j`,
      link: "/conges",
    });
  }

  await logAudit({
    userId: me.id,
    action: "CREATE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: created.id,
    details: `${data.type} · ${data.startDate} → ${data.endDate} (${days}j)`,
  });

  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  redirect("/conges");
}

// ============================================================
//  Chargement commun pour une décision
// ============================================================
async function loadRequestForDecision(requestId: string) {
  return prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      agent: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

function isTerminal(status: LeaveStatus): boolean {
  return (
    status === LeaveStatus.AUTORISE ||
    status === LeaveStatus.REFUSE ||
    status === LeaveStatus.ANNULE
  );
}

// ============================================================
//  VALIDER (avis FAVORABLE) — avance d'un niveau
// ============================================================
export async function approveLeaveRequest(
  requestId: string,
  _prev: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const me = await getCurrentUser();
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const request = await loadRequestForDecision(requestId);
  if (!request) return { ok: false, message: "Demande introuvable." };
  if (isTerminal(request.status)) {
    return { ok: false, message: "Cette demande est déjà traitée." };
  }
  if (
    me.agent &&
    request.agentId === me.agent.id &&
    me.role !== Role.DIRECTION
  ) {
    return { ok: false, message: "Vous ne pouvez pas valider votre propre demande." };
  }

  const chain = await buildRequestChain(request.agentId);
  const level = request.currentLevel ?? 1;
  if (
    !canDecideStep({
      chain,
      currentLevel: level,
      userAgentId: me.agent?.id ?? null,
      userRole: me.role,
    })
  ) {
    return {
      ok: false,
      message: "Vous n'êtes pas le validateur attendu à ce niveau.",
    };
  }

  const isLast = level >= chain.length;
  const newStatus = isLast ? LeaveStatus.AUTORISE : LeaveStatus.EN_ATTENTE;
  const newLevel = isLast ? null : level + 1;
  const newApprover = isLast ? null : chain[newLevel! - 1].validatorAgentId;
  const year = request.startDate.getFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.create({
      data: {
        requestId,
        level,
        decision: LeaveDecision.FAVORABLE,
        comment,
        decidedById: me.id,
      },
    });
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        currentLevel: newLevel,
        currentApproverAgentId: newApprover,
        approverId: me.agent?.id ?? null,
        decidedAt: new Date(),
      },
    });
    if (newStatus === LeaveStatus.AUTORISE) {
      await tx.leaveBalance.upsert({
        where: {
          agentId_year_type: { agentId: request.agentId, year, type: request.type },
        },
        create: {
          agentId: request.agentId,
          year,
          type: request.type,
          totalDays: 0,
          usedDays: request.days,
        },
        update: { usedDays: { increment: request.days } },
      });
    }
  });

  if (isLast) {
    await notifyAgent(request.agentId, {
      type: NotificationType.VALIDATION,
      title: "Congé autorisé",
      message: `${request.type} · ${request.days}j — votre congé est autorisé.`,
      link: "/conges",
    });
  } else {
    await notifyAgent(chain[newLevel! - 1].validatorAgentId, {
      type: NotificationType.VALIDATION,
      title: "Demande de congé à valider",
      message: `${request.agent.firstName} ${request.agent.lastName} · ${request.type} · ${request.days}j`,
      link: "/conges",
    });
  }

  await logAudit({
    userId: me.id,
    action: "APPROVE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
    details: `niveau ${level} · ${request.agent.firstName} ${request.agent.lastName} → ${newStatus}`,
  });

  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message: isLast ? "Congé autorisé." : "Validé et transmis au niveau suivant.",
  };
}

// ============================================================
//  REFUSER (avis DÉFAVORABLE) — clôt la demande
// ============================================================
export async function rejectLeaveRequest(
  requestId: string,
  _prev: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const me = await getCurrentUser();
  const reason = String(formData.get("reason") ?? "").trim();

  const request = await loadRequestForDecision(requestId);
  if (!request) return { ok: false, message: "Demande introuvable." };
  if (isTerminal(request.status)) {
    return { ok: false, message: "Cette demande est déjà traitée." };
  }
  if (
    me.agent &&
    request.agentId === me.agent.id &&
    me.role !== Role.DIRECTION
  ) {
    return { ok: false, message: "Vous ne pouvez pas refuser votre propre demande." };
  }

  const chain = await buildRequestChain(request.agentId);
  const level = request.currentLevel ?? 1;
  if (
    !canDecideStep({
      chain,
      currentLevel: level,
      userAgentId: me.agent?.id ?? null,
      userRole: me.role,
    })
  ) {
    return {
      ok: false,
      message: "Vous n'êtes pas le validateur attendu à ce niveau.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.create({
      data: {
        requestId,
        level,
        decision: LeaveDecision.DEFAVORABLE,
        comment: reason || null,
        decidedById: me.id,
      },
    });
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveStatus.REFUSE,
        currentLevel: null,
        currentApproverAgentId: null,
        approverId: me.agent?.id ?? null,
        decidedAt: new Date(),
      },
    });
  });

  await notifyAgent(request.agentId, {
    type: NotificationType.ALERTE,
    title: "Demande de congé refusée",
    message: reason ? `Motif : ${reason}` : "Votre demande a été refusée.",
    link: "/conges",
  });

  await logAudit({
    userId: me.id,
    action: "REJECT_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
    details: `niveau ${level} · ${request.agent.firstName} ${request.agent.lastName} · motif="${reason || "—"}"`,
  });

  revalidatePath("/conges");
  return { ok: true, message: "Demande refusée." };
}

// ============================================================
//  ANNULER — par l'auteur, tant qu'elle n'est pas refusée/annulée
// ============================================================
export async function cancelLeaveRequest(
  requestId: string,
  _prev: LeaveActionState,
  _formData: FormData,
): Promise<LeaveActionState> {
  const me = await getCurrentUser();
  if (!me.agent) {
    return { ok: false, message: "Compte non relié à un agent." };
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      agentId: true,
      status: true,
      type: true,
      days: true,
      startDate: true,
    },
  });
  if (!request) return { ok: false, message: "Demande introuvable." };

  if (
    request.agentId !== me.agent.id &&
    me.role !== Role.DRH &&
    me.role !== Role.DIRECTION
  ) {
    return { ok: false, message: "Vous ne pouvez annuler que vos propres demandes." };
  }

  if (request.status === LeaveStatus.REFUSE || request.status === LeaveStatus.ANNULE) {
    return { ok: false, message: "Cette demande ne peut plus être annulée." };
  }

  await prisma.$transaction(async (tx) => {
    const wasAuthorized = request.status === LeaveStatus.AUTORISE;
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveStatus.ANNULE,
        currentLevel: null,
        currentApproverAgentId: null,
      },
    });
    if (wasAuthorized) {
      const year = request.startDate.getFullYear();
      await tx.leaveBalance.updateMany({
        where: { agentId: request.agentId, year, type: request.type },
        data: { usedDays: { decrement: request.days } },
      });
    }
  });

  await logAudit({
    userId: me.id,
    action: "CANCEL_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
  });

  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return { ok: true, message: "Demande annulée." };
}
