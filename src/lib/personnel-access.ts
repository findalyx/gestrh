import "server-only";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

/**
 * Filtre Prisma à appliquer sur Agent selon le rôle de l'utilisateur.
 * - DIRECTION / DRH : tout l'effectif
 * - MANAGER : agents du service qu'il gère (sinon aucun)
 * - AGENT : sa propre fiche uniquement
 */
export async function getAgentScopeWhere(): Promise<{
  where: Prisma.AgentWhereInput;
  scope: "ALL" | "SERVICE" | "SELF";
}> {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.DRH) {
    return { where: {}, scope: "ALL" };
  }

  if (user.role === Role.MANAGER && user.agent) {
    return {
      where: {
        service: { managerId: user.agent.id },
      },
      scope: "SERVICE",
    };
  }

  if (user.role === Role.AGENT && user.agent) {
    return {
      where: { id: user.agent.id },
      scope: "SELF",
    };
  }

  // Manager/Agent sans fiche Agent : aucun accès
  return { where: { id: "__none__" }, scope: "SELF" };
}

/**
 * Garantit que l'utilisateur peut accéder à la fiche `agentId`.
 * Redirige vers /personnel sinon (ou vers la racine si AGENT essaie un autre).
 */
export async function assertAgentVisible(agentId: string) {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.DRH) return user;

  if (user.role === Role.AGENT) {
    if (user.agent?.id === agentId) return user;
    redirect(user.agent ? `/personnel/${user.agent.id}` : "/");
  }

  if (user.role === Role.MANAGER) {
    // Vérifie que l'agent appartient au service géré
    const { prisma } = await import("@/lib/prisma");
    const ok = await prisma.agent.count({
      where: { id: agentId, service: { managerId: user.agent?.id } },
    });
    if (ok === 0) redirect("/personnel");
    return user;
  }

  redirect("/");
}
