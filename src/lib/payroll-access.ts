import "server-only";

import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";

/**
 * Filtre Prisma à appliquer sur PayrollRecord selon le rôle.
 * - DIRECTION / DRH : tous les bulletins
 * - AGENT : ses propres bulletins uniquement
 * - MANAGER : pas d'accès au module Paie (cf. matrice d'accès)
 */
export async function getPayrollScopeWhere(): Promise<{
  where: Prisma.PayrollRecordWhereInput;
  scope: "ALL" | "SELF";
}> {
  const user = await getCurrentUser();

  if (user.role === Role.DIRECTION || user.role === Role.DRH) {
    return { where: {}, scope: "ALL" };
  }

  if (user.role === Role.AGENT && user.agent) {
    return { where: { agentId: user.agent.id }, scope: "SELF" };
  }

  return { where: { id: "__none__" }, scope: "SELF" };
}

/**
 * Garantit que l'utilisateur peut voir un bulletin donné.
 * Retourne true si autorisé, false sinon.
 */
export async function canViewPayroll(payrollAgentId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (user.role === Role.DIRECTION || user.role === Role.DRH) return true;
  if (user.role === Role.AGENT) return user.agent?.id === payrollAgentId;
  return false;
}

// Taux de cotisations salariales — Sénégal (simplifié)
export const PAYROLL_RATES = {
  ipres: 0.056, // IPRES : 5,6 % salarial
  ipm: 0.03, // IPM : 3 % salarial
} as const;

/**
 * Calcule les cotisations salariales sur la base brute.
 * Renvoie un nombre entier (FCFA).
 */
export function computeEmployeeContributions(gross: number): number {
  return Math.round(gross * (PAYROLL_RATES.ipres + PAYROLL_RATES.ipm));
}

/**
 * Calcule le net à payer.
 * net = brut − cotisations salariales − déductions diverses
 */
export function computeNetSalary(args: {
  baseSalary: number;
  bonuses: number;
  allowances: number;
  deductions: number;
}): { gross: number; contributions: number; net: number } {
  const gross = args.baseSalary + args.bonuses + args.allowances;
  const contributions = computeEmployeeContributions(gross);
  const net = Math.max(0, gross - contributions - args.deductions);
  return { gross, contributions, net };
}
