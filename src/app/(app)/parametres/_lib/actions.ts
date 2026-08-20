"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { AgentStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import {
  initializeAnnualBalances,
  runMonthlyAccrual,
  setAccrualCheckpoint,
} from "@/lib/leave-accrual";

export type ActionState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | undefined;

// ============================================================
//  CHANGER LE RÔLE D'UN UTILISATEUR — DIRECTION + DRH (mêmes droits admin)
// ============================================================
export async function changeUserRole(
  targetUserId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

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

  // Créer un compte Direction reste réservé à la Direction et au RH.
  if (
    role === Role.DIRECTION &&
    me.role !== Role.DIRECTION &&
    me.role !== Role.DRH
  ) {
    return {
      ok: false,
      error: "Seul un compte Direction ou RH peut créer un compte Direction.",
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
//  AFFECTER UN MANAGER À UN SERVICE — DIRECTION + DRH
// ============================================================
export async function assignServiceManager(
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

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

  // Le manager n'est pas forcément membre du service : un même responsable
  // peut diriger plusieurs services (ex. Administratif + Technique). On exige
  // seulement que ce soit un agent encore en poste.
  if (newManagerId) {
    const ok = await prisma.agent.count({
      where: {
        id: newManagerId,
        status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
      },
    });
    if (ok === 0) {
      return {
        ok: false,
        error: "Agent introuvable ou n'étant plus en poste.",
      };
    }
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { managerId: newManagerId },
  });

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

// ============================================================
//  SAISIE MANUELLE DES SOLDES JUSQU'A UNE DATE D'ARRETE — DIRECTION + DRH
// ============================================================
/**
 * Reprise des soldes de conges annuels : on saisit, agent par agent, les jours
 * acquis et les jours pris arretes a la FIN du mois choisi. La date d'arrete
 * devient le point de depart du calcul automatique : chaque mois ecoule ensuite
 * ajoute 2 jours (voir runMonthlyAccrual).
 */
export async function saveLeaveBalances(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(Role.DIRECTION, Role.DRH);

  const cutoff = String(formData.get("cutoff") ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cutoff)) {
    return { ok: false, error: "Date d'arrêté invalide (format attendu : mois)." };
  }
  const year = Number(cutoff.slice(0, 4));

  const num = (raw: FormDataEntryValue | null): number | null => {
    const v = String(raw ?? "").trim().replace(",", ".");
    if (v === "") return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  type Row = { agentId: string; totalDays: number; usedDays: number };
  const rows: Row[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("acq_")) continue;
    const agentId = key.slice(4);
    const totalDays = num(value);
    const usedDays = num(formData.get(`use_${agentId}`)) ?? 0;
    if (totalDays === null) continue; // ligne laissée vide → non modifiée
    if (totalDays < 0 || usedDays < 0) {
      return { ok: false, error: "Les jours saisis ne peuvent pas être négatifs." };
    }
    if (usedDays > totalDays) {
      return {
        ok: false,
        error: "Les jours pris ne peuvent pas dépasser les jours acquis.",
      };
    }
    rows.push({ agentId, totalDays, usedDays });
  }

  if (rows.length === 0) {
    return { ok: false, error: "Aucun solde saisi." };
  }

  for (const r of rows) {
    await prisma.leaveBalance.upsert({
      where: {
        agentId_year_type: {
          agentId: r.agentId,
          year,
          type: LeaveType.ANNUEL,
        },
      },
      create: {
        agentId: r.agentId,
        year,
        type: LeaveType.ANNUEL,
        totalDays: r.totalDays,
        usedDays: r.usedDays,
      },
      update: { totalDays: r.totalDays, usedDays: r.usedDays },
    });
  }

  // Le calcul automatique repart du mois SUIVANT la date d'arrêté.
  await setAccrualCheckpoint(cutoff);

  await logAudit({
    userId: me.id,
    action: "SET_LEAVE_BALANCES",
    entity: "LeaveBalance",
    details: `${rows.length} agent(s), arrêté au ${cutoff}`,
  });

  revalidatePath("/parametres");
  revalidatePath("/parametres/soldes");
  revalidatePath("/conges");
  return {
    ok: true,
    message: `Soldes enregistrés pour ${rows.length} agent(s), arrêtés à fin ${cutoff}. L'acquisition automatique reprend au mois suivant.`,
  };
}

// Helper
function isRole(v: string): v is Role {
  // Couvre tous les rôles de l'enum (dont RECTEUR et DOYEN, qui valident des congés).
  return (Object.values(Role) as string[]).includes(v);
}
