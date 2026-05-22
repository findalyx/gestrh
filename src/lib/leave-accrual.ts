import "server-only";

import { AgentStatus, LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Droit aux congés annuels selon le code du travail sénégalais :
 * 2 jours ouvrables / mois × 12 = 24 jours / an.
 */
export const MONTHLY_ACCRUAL_DAYS = 2;
export const ANNUAL_LEAVE_CAP = 24;

const LAST_ACCRUAL_KEY = "last_annual_accrual_yymm";

function yymm(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseYYMM(s: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

function monthsBetween(
  from: { year: number; month: number },
  to: { year: number; month: number },
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/**
 * Initialise les soldes ANNUEL de tous les agents actifs pour l'année en cours,
 * proratisés selon leur date d'embauche.
 *
 * Règle : pour un agent embauché avant le 1er janvier de l'année courante,
 * il a accumulé `(mois courant) × 2` jours depuis janvier.
 * Pour un agent embauché en cours d'année, on prend les mois entiers depuis
 * son embauche jusqu'au mois courant (inclus).
 *
 * `usedDays` est remis à 0 (clean slate à l'ouverture).
 *
 * Retourne le nombre d'agents traités.
 */
export async function initializeAnnualBalances(): Promise<number> {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const agents = await prisma.agent.findMany({
    where: { status: AgentStatus.ACTIF },
    select: { id: true, hireDate: true },
  });

  for (const a of agents) {
    let startMonth = 1;
    if (a.hireDate.getFullYear() === year) {
      startMonth = a.hireDate.getMonth() + 1;
    } else if (a.hireDate.getFullYear() > year) {
      // Embauché après l'année courante (rare mais possible) : pas d'accumulation
      startMonth = currentMonth + 1;
    }
    const monthsAccrued = Math.max(0, currentMonth - startMonth + 1);
    const totalDays = Math.min(
      ANNUAL_LEAVE_CAP,
      monthsAccrued * MONTHLY_ACCRUAL_DAYS,
    );

    await prisma.leaveBalance.upsert({
      where: {
        agentId_year_type: {
          agentId: a.id,
          year,
          type: LeaveType.ANNUEL,
        },
      },
      create: {
        agentId: a.id,
        year,
        type: LeaveType.ANNUEL,
        totalDays,
        usedDays: 0,
      },
      update: {
        totalDays,
        usedDays: 0,
      },
    });
  }

  // Marque le compteur d'accrual au mois courant pour éviter une double exécution.
  await prisma.appSetting.upsert({
    where: { key: LAST_ACCRUAL_KEY },
    create: { key: LAST_ACCRUAL_KEY, value: yymm(now) },
    update: { value: yymm(now) },
  });

  return agents.length;
}

/**
 * Exécute le calcul mensuel : ajoute 2 jours au totalDays de chaque agent actif,
 * pour chaque mois écoulé depuis la dernière exécution. Le solde est plafonné
 * à 24 jours pour l'année en cours.
 *
 * Idempotent : si on l'appelle deux fois le même mois, le second appel ne fait rien.
 *
 * Retourne { months: nombre de mois traités, agents: nombre d'agents mis à jour }.
 */
export async function runMonthlyAccrual(): Promise<{
  months: number;
  agents: number;
}> {
  const now = new Date();
  const currentYM = { year: now.getFullYear(), month: now.getMonth() + 1 };

  const setting = await prisma.appSetting.findUnique({
    where: { key: LAST_ACCRUAL_KEY },
  });

  // Si jamais initialisé, ne fait rien — il faut d'abord initialiser.
  if (!setting) return { months: 0, agents: 0 };

  const lastYM = parseYYMM(setting.value);
  if (!lastYM) return { months: 0, agents: 0 };

  const delta = monthsBetween(lastYM, currentYM);
  if (delta <= 0) return { months: 0, agents: 0 };

  const daysToAdd = delta * MONTHLY_ACCRUAL_DAYS;

  // Récupère les agents actifs avec leur solde courant pour appliquer le cap.
  const balances = await prisma.leaveBalance.findMany({
    where: {
      year: currentYM.year,
      type: LeaveType.ANNUEL,
      agent: { status: AgentStatus.ACTIF },
    },
    select: { id: true, totalDays: true },
  });

  let updated = 0;
  for (const b of balances) {
    const newTotal = Math.min(ANNUAL_LEAVE_CAP, b.totalDays + daysToAdd);
    if (newTotal === b.totalDays) continue;
    await prisma.leaveBalance.update({
      where: { id: b.id },
      data: { totalDays: newTotal },
    });
    updated++;
  }

  // Met à jour le marqueur même si plafonné — on a "consommé" les mois.
  await prisma.appSetting.update({
    where: { key: LAST_ACCRUAL_KEY },
    data: { value: yymm(now) },
  });

  return { months: delta, agents: updated };
}

/**
 * À appeler sur les pages serveur pour assurer que le calcul mensuel est à jour.
 * Idempotent et silencieux ; les erreurs sont avalées pour ne pas bloquer la page.
 */
export async function ensureMonthlyAccrualUpToDate(): Promise<void> {
  try {
    await runMonthlyAccrual();
  } catch (e) {
    // On ne veut pas faire planter la page pour ça
    console.error("[leave-accrual] runMonthlyAccrual failed:", e);
  }
}

/**
 * Indique si une initialisation a déjà été effectuée (en vérifiant le marqueur).
 */
export async function hasBeenInitialized(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: LAST_ACCRUAL_KEY },
  });
  return setting !== null;
}

/**
 * Renvoie la date du dernier calcul mensuel (au format "YYYY-MM"), ou null.
 */
export async function getLastAccrualYYMM(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: LAST_ACCRUAL_KEY },
  });
  return setting?.value ?? null;
}
