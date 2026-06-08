import { prisma } from "@/lib/prisma";
import { AgentStatus } from "@prisma/client";

export type BirthdayItem = {
  agentId: string;
  fullName: string;
  firstName: string;
  serviceName: string;
  day: number;
  month: number; // 1-12
  age: number | null; // âge atteint à ce prochain anniversaire
  isToday: boolean;
  daysUntil: number; // 0 = aujourd'hui
};

/** Nombre de jours (0..365) jusqu'au prochain anniversaire (jour/mois). */
function daysUntilNextBirthday(birth: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Anniversaires des agents actifs : ceux du jour d'abord, puis les prochains
 * dans la fenêtre `horizonDays`. Triés par proximité.
 */
export async function listUpcomingBirthdays(
  now: Date = new Date(),
  horizonDays = 30,
): Promise<BirthdayItem[]> {
  const agents = await prisma.agent.findMany({
    where: { status: AgentStatus.ACTIF, birthDate: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      service: { select: { name: true } },
    },
  });

  const items: BirthdayItem[] = [];
  for (const a of agents) {
    if (!a.birthDate) continue;
    const d = daysUntilNextBirthday(a.birthDate, now);
    if (d > horizonDays) continue;
    // Âge atteint au prochain anniversaire (= année du prochain anniv − année de naissance).
    const nextBirthdayYear = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    nextBirthdayYear.setDate(nextBirthdayYear.getDate() + d);
    const age = nextBirthdayYear.getFullYear() - a.birthDate.getFullYear();
    items.push({
      agentId: a.id,
      fullName: `${a.lastName.toUpperCase()} ${a.firstName}`,
      firstName: a.firstName,
      serviceName: a.service.name,
      day: a.birthDate.getDate(),
      month: a.birthDate.getMonth() + 1,
      age: Number.isFinite(age) ? age : null,
      isToday: d === 0,
      daysUntil: d,
    });
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil || a.fullName.localeCompare(b.fullName));
  return items;
}
