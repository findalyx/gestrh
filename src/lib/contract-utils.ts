/**
 * Helpers contractuels — calculs purs, sans I/O.
 * Utilisés par la fiche agent, le tableau de bord et les alertes.
 */
import {
  ContractType,
  ContractStatus,
  StaffCategory,
  type Contract,
  type Agent,
} from "@prisma/client";

/** Âge légal de retraite selon la catégorie (Sénégal). */
export const RETIREMENT_AGE: Record<StaffCategory, number> = {
  PER: 65,
  PATS: 60,
};

/** Seuils d'alerte pour les fins de CDD, en jours. */
export const CDD_ALERT_THRESHOLDS = [15, 30, 60, 90] as const;

export type CddAlertLevel = "expire" | "imminent" | "proche" | "anticipe" | "normal";

/** Niveau d'alerte pour un CDD donné. */
export function cddAlertLevel(daysRemaining: number | null): CddAlertLevel {
  if (daysRemaining === null) return "normal";
  if (daysRemaining < 0) return "expire";
  if (daysRemaining <= 15) return "imminent";
  if (daysRemaining <= 30) return "proche";
  if (daysRemaining <= 90) return "anticipe";
  return "normal";
}

const DAY_MS = 86_400_000;

/** Nombre de jours entiers entre aujourd'hui et la date. Négatif si passée. */
export function daysUntil(target: Date | null | undefined, now: Date = new Date()): number | null {
  if (!target) return null;
  const t = new Date(target).setHours(0, 0, 0, 0);
  const n = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((t - n) / DAY_MS);
}

export type RetirementInfo = {
  retirementAge: number;
  retirementDate: Date;
  yearsRemaining: number;
  monthsRemaining: number;
  totalMonthsRemaining: number;
  /** Étape d'alerte : 24, 12, 6, 3 mois ou null. */
  alertWindow: 24 | 12 | 6 | 3 | null;
};

/** Décompte avant la retraite (basé sur la date de naissance et la catégorie). */
export function retirementInfo(
  agent: Pick<Agent, "birthDate" | "category">,
  now: Date = new Date(),
): RetirementInfo | null {
  if (!agent.birthDate) return null;
  const age = RETIREMENT_AGE[agent.category];
  const birth = new Date(agent.birthDate);
  const retirementDate = new Date(birth);
  retirementDate.setFullYear(birth.getFullYear() + age);

  const totalMonths =
    (retirementDate.getFullYear() - now.getFullYear()) * 12 +
    (retirementDate.getMonth() - now.getMonth());

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths - years * 12;

  let alertWindow: RetirementInfo["alertWindow"] = null;
  if (totalMonths <= 3 && totalMonths > 0) alertWindow = 3;
  else if (totalMonths <= 6) alertWindow = 6;
  else if (totalMonths <= 12) alertWindow = 12;
  else if (totalMonths <= 24) alertWindow = 24;

  return {
    retirementAge: age,
    retirementDate,
    yearsRemaining: years,
    monthsRemaining: months,
    totalMonthsRemaining: totalMonths,
    alertWindow,
  };
}

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacation",
  STAGE: "Stage",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  RENOUVELE: "Renouvelé",
  RESILIE: "Résilié",
  EN_ATTENTE_SIGNATURE: "En attente de signature",
  ROMPU: "Rompu",
};

/** Détermine si la période d'essai est en cours pour un contrat. */
export function probationStatus(
  contract: Pick<Contract, "probationEndDate" | "startDate">,
  now: Date = new Date(),
): {
  active: boolean;
  daysRemaining: number | null;
  alert: boolean;
} {
  if (!contract.probationEndDate) {
    return { active: false, daysRemaining: null, alert: false };
  }
  const remaining = daysUntil(contract.probationEndDate, now);
  const active = remaining !== null && remaining >= 0;
  return {
    active,
    daysRemaining: remaining,
    alert: active && remaining !== null && remaining <= 15,
  };
}

/** Format FCFA — entier avec espaces insécables tous les 3 chiffres. */
export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR").replace(/\s/g, " ")} FCFA`;
}

/** Format date FR court : 04 juin 2026. */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
