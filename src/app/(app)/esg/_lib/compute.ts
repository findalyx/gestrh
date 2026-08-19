import "server-only";

import {
  AgentStatus,
  DepartureReason,
  Gender,
  Role,
  StaffCategory,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Calcule les indicateurs ESG dérivés des données RH pour une période
 * [start, end]. Renvoie une map `metricKey.auto` → valeur (chaîne).
 * Les pourcentages sont stockés en nombre (ex. "37.3" = 37,3 %).
 */

// Salariés présents = PER + PATS, statut Actif/Suspendu (hors prestataires).
const EMPLOYEE = {
  status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
  category: { in: [StaffCategory.PER, StaffCategory.PATS] },
};

const VOLUNTARY: DepartureReason[] = [
  DepartureReason.DEMISSION,
  DepartureReason.RETRAITE,
  DepartureReason.RUPTURE_CONVENTIONNELLE,
];
const INVOLUNTARY: DepartureReason[] = [
  DepartureReason.LICENCIEMENT,
  DepartureReason.FIN_CDD,
  DepartureReason.ABANDON_POSTE,
];
const LEADERSHIP: Role[] = [
  Role.DIRECTION,
  Role.RECTEUR,
  Role.DOYEN,
  Role.DRH,
  Role.MANAGER,
];

function pct(part: number, total: number): string {
  if (total <= 0) return "";
  return ((part / total) * 100).toFixed(1);
}

function monthsBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (d <= last) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export async function computeEsgAuto(
  startDate: Date,
  endDate: Date,
  usdRate: number | null,
): Promise<Record<string, string>> {
  const [
    totalFte,
    femaleFte,
    youthAgents,
    seniors,
    femaleSeniors,
    turnoverVol,
    turnoverInvol,
    newJobs,
  ] = await Promise.all([
    prisma.agent.count({ where: EMPLOYEE }),
    prisma.agent.count({ where: { ...EMPLOYEE, gender: Gender.FEMME } }),
    prisma.agent.findMany({
      where: { ...EMPLOYEE, birthDate: { not: null } },
      select: { birthDate: true },
    }),
    prisma.agent.count({
      where: { ...EMPLOYEE, user: { is: { role: { in: LEADERSHIP } } } },
    }),
    prisma.agent.count({
      where: {
        ...EMPLOYEE,
        gender: Gender.FEMME,
        user: { is: { role: { in: LEADERSHIP } } },
      },
    }),
    prisma.agent.count({
      where: {
        category: { in: [StaffCategory.PER, StaffCategory.PATS] },
        departureReason: { in: VOLUNTARY },
        departureDate: { gte: startDate, lte: endDate },
      },
    }),
    prisma.agent.count({
      where: {
        category: { in: [StaffCategory.PER, StaffCategory.PATS] },
        departureReason: { in: INVOLUNTARY },
        departureDate: { gte: startDate, lte: endDate },
      },
    }),
    prisma.agent.count({
      where: {
        category: { in: [StaffCategory.PER, StaffCategory.PATS] },
        hireDate: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  // Jeunes 16-25 ans (âge à la fin de période)
  let youthFte = 0;
  const yearMs = 365.25 * 24 * 3600 * 1000;
  for (const a of youthAgents) {
    if (!a.birthDate) continue;
    const age = (endDate.getTime() - a.birthDate.getTime()) / yearMs;
    if (age >= 16 && age <= 25) youthFte++;
  }

  // Écart de rémunération H/F sur la dernière période de paie ≤ fin de trimestre
  const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
  const refPeriod = await prisma.payrollRecord.findFirst({
    where: { netSalary: { gt: 0 }, period: { lte: endMonth } },
    orderBy: { period: "desc" },
    select: { period: true },
  });
  let genderPayGap = "";
  if (refPeriod) {
    const rows = await prisma.payrollRecord.findMany({
      where: { period: refPeriod.period },
      select: {
        baseSalary: true,
        bonuses: true,
        allowances: true,
        agent: { select: { gender: true } },
      },
    });
    let mSum = 0,
      mN = 0,
      fSum = 0,
      fN = 0;
    for (const r of rows) {
      const brut = r.baseSalary + r.bonuses + r.allowances;
      if (r.agent.gender === Gender.HOMME) {
        mSum += brut;
        mN++;
      } else {
        fSum += brut;
        fN++;
      }
    }
    if (mN > 0 && fN > 0) {
      const avgM = mSum / mN;
      const avgF = fSum / fN;
      if (avgM > 0) genderPayGap = (((avgM - avgF) / avgM) * 100).toFixed(1);
    }
  }

  // Masse salariale brute du trimestre → USD
  let totalWagesUsd = "";
  if (usdRate && usdRate > 0) {
    const months = monthsBetween(startDate, endDate);
    const agg = await prisma.payrollRecord.aggregate({
      where: { period: { in: months } },
      _sum: { baseSalary: true, bonuses: true, allowances: true },
    });
    const brutFcfa =
      (agg._sum.baseSalary ?? 0) +
      (agg._sum.bonuses ?? 0) +
      (agg._sum.allowances ?? 0);
    if (brutFcfa > 0) totalWagesUsd = Math.round(brutFcfa / usdRate).toString();
  }

  const leavers = turnoverVol + turnoverInvol;

  return {
    totalFte: String(totalFte),
    femaleFte: String(femaleFte),
    pctFemaleFte: pct(femaleFte, totalFte),
    youthFte: String(youthFte),
    pctYouthFte: pct(youthFte, totalFte),
    seniorManagers: String(seniors),
    femaleSenior: String(femaleSeniors),
    pctFemaleSenior: pct(femaleSeniors, seniors),
    genderPayGap,
    turnoverVoluntary: String(turnoverVol),
    turnoverInvoluntary: String(turnoverInvol),
    pctTurnover: pct(leavers, totalFte),
    newJobs: String(newJobs),
    totalWagesUsd,
  };
}
