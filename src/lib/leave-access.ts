import "server-only";

import type { Prisma } from "@prisma/client";
import { Role, LeaveStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

const READ_ALL_ROLES: Role[] = [
  Role.DIRECTION,
  Role.RECTEUR,
  Role.DOYEN,
  Role.DRH,
];

/**
 * Filtre Prisma à appliquer sur LeaveRequest selon le rôle de l'utilisateur.
 * - DIRECTION / RECTEUR / DOYEN / DRH : toutes les demandes (lecture)
 * - MANAGER : son équipe + ses propres demandes
 * - AGENT : ses propres demandes uniquement
 */
export async function getLeaveScopeWhere(): Promise<{
  where: Prisma.LeaveRequestWhereInput;
  scope: "ALL" | "TEAM" | "SELF";
}> {
  const user = await getCurrentUser();

  if (READ_ALL_ROLES.includes(user.role)) {
    return { where: {}, scope: "ALL" };
  }

  if (user.role === Role.MANAGER && user.agent) {
    return {
      where: {
        OR: [
          { agentId: user.agent.id },
          { agent: { service: { managerId: user.agent.id } } },
        ],
      },
      scope: "TEAM",
    };
  }

  if (user.role === Role.AGENT && user.agent) {
    return {
      where: { agentId: user.agent.id },
      scope: "SELF",
    };
  }

  return { where: { id: "__none__" }, scope: "SELF" };
}

/**
 * Filtre pour les demandes en attente d'action de l'utilisateur courant,
 * selon son niveau dans la chaîne de validation.
 * - MANAGER (Chef de Service) : EN_ATTENTE_CHEF de son équipe
 * - DOYEN : EN_ATTENTE_DOYEN
 * - DG (DIRECTION) / RECTEUR : EN_ATTENTE_DG
 * - DRH / AGENT : aucune (la DRH gère les attestations, pas la validation)
 */
export async function getMyPendingApprovalsWhere(): Promise<{
  where: Prisma.LeaveRequestWhereInput;
  canApprove: boolean;
}> {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.RECTEUR) {
    return { where: { status: LeaveStatus.EN_ATTENTE_DG }, canApprove: true };
  }

  if (user.role === Role.DOYEN) {
    return { where: { status: LeaveStatus.EN_ATTENTE_DOYEN }, canApprove: true };
  }

  if (user.role === Role.MANAGER && user.agent) {
    return {
      where: {
        status: LeaveStatus.EN_ATTENTE_CHEF,
        agent: { service: { managerId: user.agent.id } },
      },
      canApprove: true,
    };
  }

  return { where: { id: "__none__" }, canApprove: false };
}
