import { LeaveStatus, LeaveApprovalLevel, Role } from "@prisma/client";

/**
 * Chaîne de validation des congés — Université St Christopher.
 *
 *   Employé → Chef de Service → Doyen → DG/Recteur → AUTORISÉ
 *
 * Cas particulier : le personnel du service « Direction Générale » est validé
 * directement par le DG (niveau final uniquement).
 *
 * Auto-skip : si le demandeur occupe lui-même un niveau intermédiaire
 * (Chef de son service, ou Doyen), ce niveau est sauté. Le niveau final
 * (DG/Recteur) n'est jamais sauté — un demandeur ne peut pas s'auto-valider
 * (contrôlé dans l'action).
 */

export const DG_SERVICE_NAME = "Direction Générale";

export type LeaveContext = {
  serviceName: string | null;
  serviceManagerId: string | null;
  requester: { agentId: string; role: Role };
};

const LEVEL_STATUS: Record<LeaveApprovalLevel, LeaveStatus> = {
  CHEF: LeaveStatus.EN_ATTENTE_CHEF,
  DOYEN: LeaveStatus.EN_ATTENTE_DOYEN,
  DG_RECTEUR: LeaveStatus.EN_ATTENTE_DG,
};

function isDgService(serviceName: string | null): boolean {
  return (serviceName ?? "").trim().toLowerCase() === DG_SERVICE_NAME.toLowerCase();
}

/** Niveaux applicables, après auto-skip des niveaux occupés par le demandeur. */
export function applicableLevels(ctx: LeaveContext): LeaveApprovalLevel[] {
  const base: LeaveApprovalLevel[] = isDgService(ctx.serviceName)
    ? [LeaveApprovalLevel.DG_RECTEUR]
    : [
        LeaveApprovalLevel.CHEF,
        LeaveApprovalLevel.DOYEN,
        LeaveApprovalLevel.DG_RECTEUR,
      ];
  return base.filter((lvl) => {
    if (lvl === LeaveApprovalLevel.CHEF)
      return ctx.requester.agentId !== ctx.serviceManagerId;
    if (lvl === LeaveApprovalLevel.DOYEN)
      return ctx.requester.role !== Role.DOYEN;
    return true; // DG_RECTEUR toujours conservé
  });
}

/** Statut initial d'une demande à la création. */
export function initialStatus(ctx: LeaveContext): LeaveStatus {
  return LEVEL_STATUS[applicableLevels(ctx)[0]];
}

/** Niveau correspondant à un statut « en attente », ou null. */
export function levelForStatus(status: LeaveStatus): LeaveApprovalLevel | null {
  if (status === LeaveStatus.EN_ATTENTE_CHEF) return LeaveApprovalLevel.CHEF;
  if (status === LeaveStatus.EN_ATTENTE_DOYEN) return LeaveApprovalLevel.DOYEN;
  if (status === LeaveStatus.EN_ATTENTE_DG) return LeaveApprovalLevel.DG_RECTEUR;
  return null;
}

/** Statut après une validation favorable au niveau courant. */
export function nextStatusAfterApproval(
  ctx: LeaveContext,
  currentStatus: LeaveStatus,
): LeaveStatus {
  const levels = applicableLevels(ctx);
  const cur = levelForStatus(currentStatus);
  if (!cur) return currentStatus;
  const idx = levels.indexOf(cur);
  if (idx < 0 || idx === levels.length - 1) return LeaveStatus.AUTORISE;
  return LEVEL_STATUS[levels[idx + 1]];
}

/**
 * L'utilisateur courant peut-il décider (valider/refuser) une demande
 * dans son état actuel ?
 */
export function canDecide(args: {
  status: LeaveStatus;
  userRole: Role;
  userAgentId: string | null;
  serviceManagerId: string | null;
}): boolean {
  switch (args.status) {
    case LeaveStatus.EN_ATTENTE_CHEF:
      return (
        (args.userRole === Role.MANAGER &&
          args.userAgentId != null &&
          args.userAgentId === args.serviceManagerId) ||
        args.userRole === Role.DIRECTION
      );
    case LeaveStatus.EN_ATTENTE_DOYEN:
      return args.userRole === Role.DOYEN || args.userRole === Role.DIRECTION;
    case LeaveStatus.EN_ATTENTE_DG:
      return args.userRole === Role.DIRECTION || args.userRole === Role.RECTEUR;
    default:
      return false;
  }
}

/** Tous les statuts « en attente » de la chaîne (utile pour les compteurs). */
export const PENDING_LEAVE_STATUSES: LeaveStatus[] = [
  LeaveStatus.EN_ATTENTE_CHEF,
  LeaveStatus.EN_ATTENTE_DOYEN,
  LeaveStatus.EN_ATTENTE_DG,
];
