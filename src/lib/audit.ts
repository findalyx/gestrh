import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Enregistre une action dans le journal d'audit (§5.9, §8.3 des spécifications).
 * À appeler dans toutes les Server Actions qui modifient des données sensibles.
 */
export async function logAudit(params: {
  userId: string | null;
  action: string; // ex: "CREATE_AGENT", "UPDATE_AGENT", "CHANGE_ROLE"
  entity: string; // ex: "Agent", "User"
  entityId?: string;
  details?: string; // JSON sérialisé ou texte libre
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
    },
  });
}
