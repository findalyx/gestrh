import "server-only";

import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Workflow de validation des congés — chaîne de validateurs configurable
 * par agent (1 à 4 niveaux), définie dans Paramètres.
 *
 *   Employé → Validateur niveau 1 → … → Validateur niveau N → AUTORISÉ
 *
 * Repli : si aucune chaîne n'est configurée pour l'agent, sa demande passe
 * par le Directeur Général (validateur unique).
 *
 * Le statut « en attente » est générique (EN_ATTENTE) ; le niveau courant est
 * porté par `LeaveRequest.currentLevel` (1..N).
 */

/** Statuts « en attente » (un seul, générique). */
export const PENDING_LEAVE_STATUSES: LeaveStatus[] = [LeaveStatus.EN_ATTENTE];

export type ChainStep = {
  level: number; // position 1..N
  validatorAgentId: string; // l'agent qui valide
  label: string; // libellé du rôle
};

/** Agent lié au compte DIRECTION (le DG) — validateur de repli. */
export async function getDgAgentId(): Promise<string | null> {
  const dg = await prisma.user.findFirst({
    where: { role: Role.DIRECTION, isActive: true, agentId: { not: null } },
    select: { agentId: true },
  });
  return dg?.agentId ?? null;
}

/**
 * Chaîne effective d'une demande : les étapes configurées de l'agent,
 * en excluant le demandeur lui-même (nul ne valide sa propre demande),
 * re-numérotées 1..N. Repli sur le DG si vide.
 */
export async function buildRequestChain(
  requesterAgentId: string,
): Promise<ChainStep[]> {
  const steps = await prisma.leaveApprovalStep.findMany({
    where: { agentId: requesterAgentId },
    orderBy: { level: "asc" },
    include: {
      validator: { select: { label: true, agentId: true, active: true } },
    },
  });

  const effective = steps
    .filter((s) => s.validator.active)
    .filter((s) => s.validator.agentId !== requesterAgentId);

  if (effective.length > 0) {
    return effective.map((s, i) => ({
      level: i + 1,
      validatorAgentId: s.validator.agentId,
      label: s.validator.label,
    }));
  }

  // Repli : Directeur Général (sauf si le demandeur EST le DG → chaîne vide).
  const dg = await getDgAgentId();
  if (dg && dg !== requesterAgentId) {
    return [{ level: 1, validatorAgentId: dg, label: "Directeur Général" }];
  }
  return [];
}

/**
 * L'utilisateur courant est-il le validateur DÉSIGNÉ au niveau courant ?
 * (le vrai maillon de la chaîne, hors pouvoir de Direction).
 */
export function isDesignatedValidator(args: {
  chain: ChainStep[];
  currentLevel: number | null;
  userAgentId: string | null;
}): boolean {
  if (args.currentLevel == null) return false;
  const step = args.chain[args.currentLevel - 1];
  if (!step) return false;
  return args.userAgentId != null && args.userAgentId === step.validatorAgentId;
}

/**
 * L'utilisateur courant peut-il décider sur cette demande ?
 *   - le validateur désigné au niveau courant, OU
 *   - la Direction (DG) — pouvoir de secours, avec avertissement côté UI.
 */
export function canDecideStep(args: {
  chain: ChainStep[];
  currentLevel: number | null;
  userAgentId: string | null;
  userRole: Role;
}): boolean {
  if (args.currentLevel == null) return false;
  if (args.userRole === Role.DIRECTION) return true; // override DG (averti dans l'UI)
  return isDesignatedValidator(args);
}

/** Le validateur (agentId) attendu au niveau courant, ou null. */
export function currentValidatorAgentId(
  chain: ChainStep[],
  currentLevel: number | null,
): string | null {
  if (currentLevel == null) return null;
  return chain[currentLevel - 1]?.validatorAgentId ?? null;
}
