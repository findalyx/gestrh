import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import type { Role } from "@prisma/client";

/**
 * Lecture seule de la session — renvoie null si absente / invalide / expirée.
 * À utiliser pour les vérifications souples (UI conditionnelle).
 */
export const getSession = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
});

/**
 * Vérifie la session et redirige vers /login si absente. À utiliser dans les
 * pages/layouts protégés et dans toutes les Server Actions sensibles.
 */
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

/**
 * Charge l'utilisateur authentifié + sa fiche Agent associée.
 * Memoïzé par requête : sûr d'appeler dans plusieurs Server Components.
 */
export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          category: true,
          serviceId: true,
        },
      },
    },
  });
  if (!user || !user.isActive) {
    // Compte introuvable ou désactivé : on passe par le route handler qui
    // nettoie le cookie de session pour éviter une boucle de redirection.
    redirect("/api/auth/logout");
  }
  return user;
});

/**
 * Vérifie que l'utilisateur courant possède l'un des rôles autorisés.
 * Renvoie l'utilisateur ou redirige vers la racine si non autorisé.
 */
export async function requireRole(...allowed: Role[]) {
  const user = await getCurrentUser();
  if (!allowed.includes(user.role)) {
    redirect("/");
  }
  return user;
}
