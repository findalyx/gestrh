import "server-only";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";

/**
 * Profils qui pilotent le recrutement : DG (Direction), Responsable RH et
 * Doyen Exécutif. Ils voient toutes les offres et peuvent les gérer.
 */
export const RECRUITMENT_MANAGER_ROLES: Role[] = [
  Role.DIRECTION,
  Role.DRH,
  Role.DOYEN,
];

export type RecruitmentAccess = {
  /** Peut créer / modifier une offre et faire avancer les candidatures. */
  canManage: boolean;
  /** Filtre Prisma à appliquer aux offres visibles. */
  where: Prisma.JobPostingWhereInput;
  /** Services dirigés (uniquement pour un responsable de service). */
  serviceIds: string[];
};

/**
 * Accès au module Recrutement.
 * - DIRECTION / DRH / DOYEN : toutes les offres, en gestion ;
 * - MANAGER : suivi (lecture seule) des offres rattachées à un service qu'il
 *   dirige — un responsable peut diriger plusieurs services ;
 * - autres rôles : pas d'accès.
 */
export async function requireRecruitmentAccess(): Promise<RecruitmentAccess> {
  const user = await getCurrentUser();

  if (RECRUITMENT_MANAGER_ROLES.includes(user.role)) {
    return { canManage: true, where: {}, serviceIds: [] };
  }

  if (user.role === Role.MANAGER && user.agent) {
    const services = await prisma.service.findMany({
      where: { managerId: user.agent.id },
      select: { id: true },
    });
    if (services.length > 0) {
      const serviceIds = services.map((s) => s.id);
      return {
        canManage: false,
        where: { serviceId: { in: serviceIds } },
        serviceIds,
      };
    }
  }

  redirect("/");
}

/** Réservé aux profils qui gèrent le recrutement (création, décisions…). */
export async function requireRecruitmentManager() {
  const user = await getCurrentUser();
  if (!RECRUITMENT_MANAGER_ROLES.includes(user.role)) {
    redirect("/recrutement");
  }
  return user;
}
