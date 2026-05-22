import "server-only";

import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

/**
 * Filtre sur TrainingEnrollment selon le rôle.
 * - DIRECTION / DRH : toutes les inscriptions
 * - MANAGER : son équipe + les siennes
 * - AGENT : les siennes
 */
export async function getEnrollmentScopeWhere(): Promise<{
  where: Prisma.TrainingEnrollmentWhereInput;
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
    return { where: { agentId: user.agent.id }, scope: "SELF" };
  }

  return { where: { id: "__none__" }, scope: "SELF" };
}

/**
 * Vrai si l'utilisateur peut gérer le catalogue / les sessions (créer,
 * modifier statut, marquer comme réalisé). DIRECTION ou DRH.
 */
export async function canManageTraining(): Promise<boolean> {
  const user = await getCurrentUser();
  return user.role === Role.DIRECTION || user.role === Role.DRH;
}
