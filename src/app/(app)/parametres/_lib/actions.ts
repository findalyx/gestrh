"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  initializeAnnualBalances,
  runMonthlyAccrual,
} from "@/lib/leave-accrual";

export type ActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// ============================================================
//  CHANGER LE RÔLE D'UN UTILISATEUR — DIRECTION uniquement
// ============================================================
export async function changeUserRole(
  targetUserId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION);

  const newRole = String(formData.get("role") ?? "");
  if (!isRole(newRole)) {
    return { ok: false, error: "Rôle invalide" };
  }

  if (targetUserId === me.id) {
    return { ok: false, error: "Vous ne pouvez pas modifier votre propre rôle." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { ok: false, error: "Utilisateur introuvable" };

  if (target.role === newRole) {
    return { ok: true, message: "Aucun changement." };
  }

  // Empêcher la rétrogradation du dernier DIRECTION
  if (target.role === Role.DIRECTION && newRole !== Role.DIRECTION) {
    const remaining = await prisma.user.count({
      where: { role: Role.DIRECTION, isActive: true, NOT: { id: targetUserId } },
    });
    if (remaining === 0) {
      return {
        ok: false,
        error: "Impossible : il doit rester au moins un compte Direction actif.",
      };
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  await logAudit({
    userId: me.id,
    action: "CHANGE_USER_ROLE",
    entity: "User",
    entityId: targetUserId,
    details: `${target.email} : ${target.role} → ${newRole}`,
  });

  revalidatePath("/parametres");
  return { ok: true, message: `Rôle modifié : ${target.email} est désormais ${newRole}.` };
}

// ============================================================
//  ACTIVER / DÉSACTIVER UN COMPTE — DIRECTION + DRH
// ============================================================
export async function toggleUserActive(
  targetUserId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  if (targetUserId === me.id) {
    return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, isActive: true, role: true },
  });
  if (!target) return { ok: false, error: "Utilisateur introuvable" };

  const wantActive = formData.get("active") === "true";

  if (target.isActive === wantActive) {
    return { ok: true, message: "Aucun changement." };
  }

  // Empêcher la désactivation du dernier DIRECTION
  if (!wantActive && target.role === Role.DIRECTION) {
    const remaining = await prisma.user.count({
      where: { role: Role.DIRECTION, isActive: true, NOT: { id: targetUserId } },
    });
    if (remaining === 0) {
      return {
        ok: false,
        error: "Impossible : il doit rester au moins un compte Direction actif.",
      };
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: wantActive },
  });

  await logAudit({
    userId: me.id,
    action: wantActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    entity: "User",
    entityId: targetUserId,
    details: target.email,
  });

  revalidatePath("/parametres");
  return {
    ok: true,
    message: wantActive
      ? `Compte ${target.email} activé.`
      : `Compte ${target.email} désactivé.`,
  };
}

// ============================================================
//  CRÉER UN COMPTE POUR UN AGENT EXISTANT — DIRECTION + DRH
// ============================================================
export async function createUserAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const agentId = String(formData.get("agentId") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!agentId) return { ok: false, error: "Veuillez sélectionner un agent." };
  if (!isRole(role)) return { ok: false, error: "Rôle invalide." };
  if (password.length < 8) {
    return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  }

  // Seul DIRECTION peut créer un autre DIRECTION
  if (role === Role.DIRECTION && me.role !== Role.DIRECTION) {
    return {
      ok: false,
      error: "Seul un compte Direction peut créer un autre compte Direction.",
    };
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { user: { select: { id: true } } },
  });
  if (!agent) return { ok: false, error: "Agent introuvable." };
  if (agent.user) {
    return { ok: false, error: "Cet agent a déjà un compte d'accès." };
  }

  // Email = email de l'agent
  const existing = await prisma.user.findUnique({
    where: { email: agent.email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Un compte avec cet email existe déjà." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email: agent.email,
      passwordHash,
      role,
      agentId: agent.id,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  await logAudit({
    userId: me.id,
    action: "CREATE_USER",
    entity: "User",
    entityId: created.id,
    details: `${created.email} (role=${role}) lié à l'agent ${agent.matricule}`,
  });

  revalidatePath("/parametres");
  return {
    ok: true,
    message: `Compte créé pour ${agent.firstName} ${agent.lastName} (${created.email}).`,
  };
}

// ============================================================
//  AFFECTER UN MANAGER À UN SERVICE — DIRECTION uniquement
// ============================================================
export async function assignServiceManager(
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION);

  const rawAgentId = String(formData.get("agentId") ?? "").trim();
  const newManagerId = rawAgentId === "" ? null : rawAgentId;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, name: true, manager: { select: { id: true, matricule: true } } },
  });
  if (!service) return { ok: false, error: "Service introuvable" };

  if (service.manager?.id === newManagerId) {
    return { ok: true, message: "Aucun changement." };
  }

  // Le nouveau manager doit appartenir au service (s'il y en a un)
  if (newManagerId) {
    const ok = await prisma.agent.count({
      where: { id: newManagerId, serviceId },
    });
    if (ok === 0) {
      return {
        ok: false,
        error: "L'agent choisi ne fait pas partie de ce service.",
      };
    }
  }

  try {
    await prisma.service.update({
      where: { id: serviceId },
      data: { managerId: newManagerId },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Cet agent gère déjà un autre service.",
      };
    }
    throw e;
  }

  await logAudit({
    userId: me.id,
    action: "ASSIGN_SERVICE_MANAGER",
    entity: "Service",
    entityId: service.id,
    details: `${service.name} : ${service.manager?.matricule ?? "—"} → ${newManagerId ?? "—"}`,
  });

  revalidatePath("/parametres");
  return { ok: true, message: `Manager du service « ${service.name} » mis à jour.` };
}

// ============================================================
//  INITIALISER LES SOLDES ANNUELS — DIRECTION + DRH
//  ⚠️ Remet à zéro les jours utilisés et fixe les jours acquis selon
//     la date d'embauche et le mois courant (24 jours/an, 2/mois).
// ============================================================
export async function initializeLeaveBalances(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const count = await initializeAnnualBalances();

  await logAudit({
    userId: me.id,
    action: "INITIALIZE_LEAVE_BALANCES",
    entity: "LeaveBalance",
    details: `${count} agents traités (jours utilisés réinitialisés)`,
  });

  revalidatePath("/parametres");
  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message: `Soldes annuels initialisés pour ${count} agent(s).`,
  };
}

// ============================================================
//  LANCER LE CALCUL MENSUEL MAINTENANT — DIRECTION + DRH
//  Idempotent : ne fait rien si le mois courant est déjà traité.
// ============================================================
export async function triggerMonthlyAccrual(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const { months, agents } = await runMonthlyAccrual();

  if (months === 0) {
    return { ok: true, message: "Le calcul du mois est déjà à jour." };
  }

  await logAudit({
    userId: me.id,
    action: "RUN_MONTHLY_ACCRUAL",
    entity: "LeaveBalance",
    details: `${months} mois × ${agents} agents`,
  });

  revalidatePath("/parametres");
  revalidatePath("/conges");
  revalidatePath("/tableau-de-bord");
  return {
    ok: true,
    message: `Calcul effectué : +${months * 2} jour(s) pour ${agents} agent(s).`,
  };
}

// Helper
function isRole(v: string): v is Role {
  return v === "DIRECTION" || v === "DRH" || v === "MANAGER" || v === "AGENT";
}
