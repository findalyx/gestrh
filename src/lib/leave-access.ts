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
 * Filtre pour les demandes en attente d'action de l'utilisateur courant.
 * Modèle de chaîne configurable : une demande m'attend si son validateur
 * courant (dénormalisé sur `currentApproverAgentId`) est mon propre agent.
 * - DIRECTION (DG) : voit toutes les demandes en attente (pouvoir de secours)
 * - Tout agent validateur : les demandes dont il est le validateur courant
 * - Sans compte agent : aucune
 */
export async function getMyPendingApprovalsWhere(): Promise<{
  where: Prisma.LeaveRequestWhereInput;
  canApprove: boolean;
}> {
  const user = await getCurrentUser();

  // Le DG peut agir en secours sur toute demande en attente.
  if (user.role === Role.DIRECTION) {
    return {
      where: { status: LeaveStatus.EN_ATTENTE },
      canApprove: true,
    };
  }

  // Tout utilisateur relié à un agent voit les demandes dont il est le
  // validateur courant (quel que soit son rôle applicatif).
  if (user.agent) {
    return {
      where: {
        status: LeaveStatus.EN_ATTENTE,
        currentApproverAgentId: user.agent.id,
      },
      canApprove: true,
    };
  }

  return { where: { id: "__none__" }, canApprove: false };
}
