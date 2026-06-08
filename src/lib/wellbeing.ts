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

/** Nombre de jours écoulés depuis le dernier anniversaire (0 = aujourd'hui). */
export function daysSinceLastBirthday(birth: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let last = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (last > today) {
    last = new Date(today.getFullYear() - 1, birth.getMonth(), birth.getDate());
  }
  return Math.round((today.getTime() - last.getTime()) / 86_400_000);
}

/** Fenêtre où l'on peut encore souhaiter : jour J et jusqu'à `daysAfter` jours après. */
export function isWithinCelebrationWindow(
  birth: Date,
  now: Date,
  daysAfter = 3,
): boolean {
  const d = daysSinceLastBirthday(birth, now);
  return d >= 0 && d <= daysAfter;
}

export type CelebrableBirthday = {
  agentId: string;
  userId: string | null; // compte destinataire du message (null si pas de compte)
  fullName: string;
  firstName: string;
  serviceName: string;
  age: number | null; // âge fêté
  daysSince: number; // 0 = aujourd'hui
  isToday: boolean;
};

/**
 * Anniversaires « à célébrer » : aujourd'hui et jusqu'à `daysAfter` jours après
 * (fenêtre durant laquelle on peut encore envoyer un message d'anniversaire).
 */
export async function listCelebrableBirthdays(
  now: Date = new Date(),
  daysAfter = 3,
): Promise<CelebrableBirthday[]> {
  const agents = await prisma.agent.findMany({
    where: { status: AgentStatus.ACTIF, birthDate: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      service: { select: { name: true } },
      user: { select: { id: true } },
    },
  });

  const items: CelebrableBirthday[] = [];
  for (const a of agents) {
    if (!a.birthDate) continue;
    const d = daysSinceLastBirthday(a.birthDate, now);
    if (d < 0 || d > daysAfter) continue;
    const lastYear =
      a.birthDate.getMonth() > now.getMonth() ||
      (a.birthDate.getMonth() === now.getMonth() &&
        a.birthDate.getDate() > now.getDate())
        ? now.getFullYear() - 1
        : now.getFullYear();
    const age = lastYear - a.birthDate.getFullYear();
    items.push({
      agentId: a.id,
      userId: a.user?.id ?? null,
      fullName: `${a.lastName.toUpperCase()} ${a.firstName}`,
      firstName: a.firstName,
      serviceName: a.service.name,
      age: Number.isFinite(age) ? age : null,
      daysSince: d,
      isToday: d === 0,
    });
  }
  items.sort((a, b) => a.daysSince - b.daysSince || a.fullName.localeCompare(b.fullName));
  return items;
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
