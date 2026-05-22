import "server-only";

import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

/**
 * Filtre Prisma à appliquer sur Evaluation selon le rôle.
 * - DIRECTION / DRH : toutes les évaluations
 * - MANAGER : évaluations de son équipe + les siennes
 * - AGENT : ses propres évaluations
 */
export async function getEvaluationScopeWhere(): Promise<{
  where: Prisma.EvaluationWhereInput;
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
 * Évaluations que l'utilisateur courant doit remplir lui-même
 * (en tant qu'évaluateur désigné).
 */
export async function getMyPendingEvaluationsWhere(): Promise<{
  where: Prisma.EvaluationWhereInput;
  canEvaluate: boolean;
}> {
  const user = await getCurrentUser();

  if (user.role === Role.AGENT || !user.agent) {
    return { where: { id: "__none__" }, canEvaluate: false };
  }

  return {
    where: {
      evaluatorId: user.agent.id,
      status: { in: ["PLANIFIEE", "EN_COURS"] },
    },
    canEvaluate: true,
  };
}

/**
 * Vrai si l'utilisateur courant peut éditer l'évaluation donnée.
 * - Évaluateur désigné (MANAGER) : oui si non TERMINEE
 * - DRH / DIRECTION : oui (override)
 */
export async function canEditEvaluation(args: {
  evaluatorId: string | null;
  status: string;
}): Promise<boolean> {
  const user = await getCurrentUser();
  if (user.role === Role.DIRECTION || user.role === Role.DRH) return true;
  if (
    user.role === Role.MANAGER &&
    user.agent &&
    args.evaluatorId === user.agent.id &&
    args.status !== "TERMINEE"
  ) {
    return true;
  }
  return false;
}
