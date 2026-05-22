import "server-only";

import type { Prisma } from "@prisma/client";
import { Role, LeaveStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

/**
 * Filtre Prisma à appliquer sur LeaveRequest selon le rôle de l'utilisateur.
 * - DIRECTION / DRH : toutes les demandes
 * - MANAGER : son équipe + ses propres demandes
 * - AGENT : ses propres demandes uniquement
 */
export async function getLeaveScopeWhere(): Promise<{
  where: Prisma.LeaveRequestWhereInput;
  scope: "ALL" | "TEAM" | "SELF";
}> {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.DRH) {
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
 * Filtre pour les demandes en attente d'action de l'utilisateur courant.
 * - MANAGER : demandes EN_ATTENTE_MANAGER de son équipe
 * - DRH / DIRECTION : demandes EN_ATTENTE_DRH
 * - AGENT : aucune (il n'a rien à valider)
 */
export async function getMyPendingApprovalsWhere(): Promise<{
  where: Prisma.LeaveRequestWhereInput;
  canApprove: boolean;
}> {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.DRH) {
    return {
      where: { status: LeaveStatus.EN_ATTENTE_DRH },
      canApprove: true,
    };
  }

  if (user.role === Role.MANAGER && user.agent) {
    return {
      where: {
        status: LeaveStatus.EN_ATTENTE_MANAGER,
        agent: { service: { managerId: user.agent.id } },
      },
      canApprove: true,
    };
  }

  return { where: { id: "__none__" }, canApprove: false };
}
