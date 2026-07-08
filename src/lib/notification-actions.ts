"use server";

import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * Marque comme lues toutes les notifications non lues de l'utilisateur courant.
 * Appelée quand il ouvre la cloche — le compteur se vide à la navigation suivante.
 */
export async function markMyNotificationsRead(): Promise<void> {
  const me = await getCurrentUser();
  await prisma.notification.updateMany({
    where: { userId: me.id, isRead: false },
    data: { isRead: true },
  });
}
