"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeaveStatus, LeaveType, Role } from "@prisma/client";
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
  nextStatusAfterApproval,
} from "./workflow";

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
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }
  const data = parsed.data;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const days = calcDays(start, end);

  // Vérifie qu'aucune demande APPROUVE de l'agent ne chevauche
  const overlap = await prisma.leaveRequest.count({
    where: {
      agentId: me.agent.id,
      status: { in: [LeaveStatus.APPROUVE, LeaveStatus.EN_ATTENTE_MANAGER, LeaveStatus.EN_ATTENTE_DRH] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap > 0) {
    return {
      errors: {
        startDate: ["Une demande de congé chevauche déjà cette période"],
      },
      values: raw,
    };
  }

  // Récupère le service pour connaître le manager
  const agentInfo = await prisma.agent.findUnique({
    where: { id: me.agent.id },
    select: {
      service: { select: { managerId: true } },
    },
  });
  const managerId = agentInfo?.service?.managerId ?? null;
  const status = initialStatus({
    type: data.type as LeaveType,
    agentServiceManagerId: managerId,
    // L'agent qui crée EST le manager du service (sa propre demande)
    agentIsSelf: managerId === me.agent.id,
  });

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
//  APPROUVER UNE DEMANDE
// ============================================================
export async function approveLeaveRequest(
  requestId: string,
  _prev: LeaveActionState,
  _formData: FormData,
): Promise<LeaveActionState> {
  const me = await getCurrentUser();
  if (!me.agent && me.role !== Role.DIRECTION) {
    return { ok: false, message: "Compte non relié à un agent." };
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          service: { select: { managerId: true } },
        },
      },
    },
  });
  if (!request) return { ok: false, message: "Demande introuvable." };

  if (
    request.status === LeaveStatus.APPROUVE ||
    request.status === LeaveStatus.REFUSE ||
    request.status === LeaveStatus.ANNULE
  ) {
    return { ok: false, message: "Cette demande est déjà traitée." };
  }

  const allowed = canDecide({
    status: request.status,
    userRole: me.role,
    userAgentId: me.agent?.id ?? null,
    agentServiceManagerId: request.agent.service.managerId,
  });
  if (!allowed) {
    return {
      ok: false,
      message: "Vous n'avez pas les droits pour approuver cette demande.",
    };
  }

  const newStatus = nextStatusAfterApproval();
  const year = request.startDate.getFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        approverId: me.agent?.id ?? null,
        decidedAt: new Date(),
      },
    });

    // Met à jour le solde — upsert au cas où la combinaison n'existe pas
    await tx.leaveBalance.upsert({
      where: {
        agentId_year_type: {
          agentId: request.agentId,
          year,
          type: request.type,
        },
      },
      create: {
        agentId: request.agentId,
        year,
        type: request.type,
        totalDays: 0,
        usedDays: request.days,
      },
      update: {
        usedDays: { increment: request.days },
      },
    });
  });

  await logAudit({
    userId: me.id,
    action: "APPROVE_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
    details: `${request.agent.firstName} ${request.agent.lastName} · ${request.type} · ${request.days}j`,
  });

  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return { ok: true, message: "Demande approuvée." };
}

// ============================================================
//  REFUSER UNE DEMANDE
// ============================================================
export async function rejectLeaveRequest(
  requestId: string,
  _prev: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const me = await getCurrentUser();

  const reason = String(formData.get("reason") ?? "").trim();

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      agent: {
        select: {
          firstName: true,
          lastName: true,
          service: { select: { managerId: true } },
        },
      },
    },
  });
  if (!request) return { ok: false, message: "Demande introuvable." };

  if (
    request.status === LeaveStatus.APPROUVE ||
    request.status === LeaveStatus.REFUSE ||
    request.status === LeaveStatus.ANNULE
  ) {
    return { ok: false, message: "Cette demande est déjà traitée." };
  }

  const allowed = canDecide({
    status: request.status,
    userRole: me.role,
    userAgentId: me.agent?.id ?? null,
    agentServiceManagerId: request.agent.service.managerId,
  });
  if (!allowed) {
    return {
      ok: false,
      message: "Vous n'avez pas les droits pour refuser cette demande.",
    };
  }

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: LeaveStatus.REFUSE,
      approverId: me.agent?.id ?? null,
      decidedAt: new Date(),
      reason: reason
        ? `${request.reason ? request.reason + "\n\n" : ""}Motif du refus : ${reason}`
        : request.reason,
    },
  });

  await logAudit({
    userId: me.id,
    action: "REJECT_LEAVE_REQUEST",
    entity: "LeaveRequest",
    entityId: requestId,
    details: `${request.agent.firstName} ${request.agent.lastName} · ${request.type} · motif="${reason || "—"}"`,
  });

  revalidatePath("/conges");
  return { ok: true, message: "Demande refusée." };
}

// ============================================================
//  ANNULER UNE DEMANDE — par l'auteur, tant qu'elle est en attente
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
    select: { id: true, agentId: true, status: true, type: true, days: true },
  });
  if (!request) return { ok: false, message: "Demande introuvable." };

  if (request.agentId !== me.agent.id && me.role !== Role.DRH && me.role !== Role.DIRECTION) {
    return {
      ok: false,
      message: "Vous ne pouvez annuler que vos propres demandes.",
    };
  }

  // Seules les demandes encore en attente ou approuvées peuvent être annulées
  if (
    request.status === LeaveStatus.REFUSE ||
    request.status === LeaveStatus.ANNULE
  ) {
    return { ok: false, message: "Cette demande ne peut plus être annulée." };
  }

  await prisma.$transaction(async (tx) => {
    // Si la demande était approuvée, on rembourse le solde
    const wasApproved = request.status === LeaveStatus.APPROUVE;

    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: LeaveStatus.ANNULE },
    });

    if (wasApproved) {
      const original = await tx.leaveRequest.findUnique({
        where: { id: requestId },
        select: { startDate: true },
      });
      if (original) {
        const year = original.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: {
            agentId: request.agentId,
            year,
            type: request.type,
          },
          data: { usedDays: { decrement: request.days } },
        });
      }
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
