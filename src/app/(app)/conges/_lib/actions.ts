"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  LeaveApprovalLevel,
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
  canDecide,
  initialStatus,
  levelForStatus,
  nextStatusAfterApproval,
  PENDING_LEAVE_STATUSES,
  type LeaveContext,
} from "./workflow";

// ============================================================
//  Notifications — destinataires selon le statut « en attente »
// ============================================================
async function recipientUserIdsForStatus(
  status: LeaveStatus,
  serviceManagerId: string | null,
): Promise<string[]> {
  if (status === LeaveStatus.EN_ATTENTE_CHEF) {
    if (!serviceManagerId) return [];
    const u = await prisma.user.findFirst({
      where: { agentId: serviceManagerId, isActive: true },
      select: { id: true },
    });
    return u ? [u.id] : [];
  }
  if (status === LeaveStatus.EN_ATTENTE_DOYEN) {
    const us = await prisma.user.findMany({
      where: { role: Role.DOYEN, isActive: true },
      select: { id: true },
    });
    return us.map((u) => u.id);
  }
  if (status === LeaveStatus.EN_ATTENTE_DG) {
    const us = await prisma.user.findMany({
      where: { role: { in: [Role.DIRECTION, Role.RECTEUR] }, isActive: true },
      select: { id: true },
    });
    return us.map((u) => u.id);
  }
  return [];
}

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

async function notifyEmployee(
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

  const agentInfo = await prisma.agent.findUnique({
    where: { id: me.agent.id },
    select: { service: { select: { name: true, managerId: true } } },
  });
  const ctx: LeaveContext = {
    serviceName: agentInfo?.service?.name ?? null,
    serviceManagerId: agentInfo?.service?.managerId ?? null,
    requester: { agentId: me.agent.id, role: me.role },
  };
  const status = initialStatus(ctx);

  const created = await prisma.leaveRequest.create({
    data: {
      agentId: me.agent.id,
      type: data.type as LeaveType,
      status,
      startDate: start,
      endDate: end,
      days,
      reason: data.reason || null,
    },
    select: { id: true },
  });

  await notify(
    await recipientUserIdsForStatus(status, ctx.serviceManagerId),
    {
      type: NotificationType.VALIDATION,
      title: "Nouvelle demande de congé à valider",
      message: `${me.agent.firstName} ${me.agent.lastName} · ${data.type} · ${days}j`,
      link: "/conges",
    },
  );

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
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          service: { select: { name: true, managerId: true } },
          user: { select: { role: true } },
        },
      },
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
  if (me.agent && request.agentId === me.agent.id) {
    return { ok: false, message: "Vous ne pouvez pas valider votre propre demande." };
  }

  const managerId = request.agent.service.managerId;
  if (
    !canDecide({
      status: request.status,
      userRole: me.role,
      userAgentId: me.agent?.id ?? null,
      serviceManagerId: managerId,
    })
  ) {
    return { ok: false, message: "Vous n'avez pas les droits pour valider cette demande à ce niveau." };
  }

  const level = levelForStatus(request.status) ?? LeaveApprovalLevel.CHEF;
  const ctx: LeaveContext = {
    serviceName: request.agent.service.name,
    serviceManagerId: managerId,
    requester: { agentId: request.agentId, role: request.agent.user?.role ?? Role.AGENT },
  };
  const newStatus = nextStatusAfterApproval(ctx, request.status);
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
        approverId: me.agent?.id ?? null,
        decidedAt: new Date(),
      },
    });
    // Le solde n'est décompté qu'à l'autorisation finale.
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

  if (newStatus === LeaveStatus.AUTORISE) {
    await notifyEmployee(request.agentId, {
      type: NotificationType.VALIDATION,
      title: "Congé autorisé",
      message: `${request.type} · ${request.days}j — votre congé est autorisé.`,
      link: "/conges",
    });
  } else {
    await notify(
      await recipientUserIdsForStatus(newStatus, managerId),
      {
        type: NotificationType.VALIDATION,
        title: "Demande de congé à valider",
        message: `${request.agent.firstName} ${request.agent.lastName} · ${request.type} · ${request.days}j`,
        link: "/conges",
      },
    );
  }

  await logAudit({
    userId: me.id,
    action: "APPROVE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
    details: `${level} · ${request.agent.firstName} ${request.agent.lastName} → ${newStatus}`,
  });

  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message:
      newStatus === LeaveStatus.AUTORISE
        ? "Congé autorisé."
        : "Validé et transmis au niveau suivant.",
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
  if (me.agent && request.agentId === me.agent.id) {
    return { ok: false, message: "Vous ne pouvez pas refuser votre propre demande." };
  }

  const managerId = request.agent.service.managerId;
  if (
    !canDecide({
      status: request.status,
      userRole: me.role,
      userAgentId: me.agent?.id ?? null,
      serviceManagerId: managerId,
    })
  ) {
    return { ok: false, message: "Vous n'avez pas les droits pour refuser cette demande." };
  }

  const level = levelForStatus(request.status) ?? LeaveApprovalLevel.CHEF;

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
        approverId: me.agent?.id ?? null,
        decidedAt: new Date(),
      },
    });
  });

  await notifyEmployee(request.agentId, {
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
    details: `${level} · ${request.agent.firstName} ${request.agent.lastName} · motif="${reason || "—"}"`,
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
    select: { id: true, agentId: true, status: true, type: true, days: true, startDate: true },
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
      data: { status: LeaveStatus.ANNULE },
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
