import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  AgentStatus,
  ContractStatus,
  EvaluationStatus,
  LeaveStatus,
  StaffCategory,
} from "@prisma/client";
import { KpiCard } from "./KpiCard";
import { CategoryDonut } from "./charts/CategoryDonut";

type Props = {
  managerAgentId: string;
  firstName: string;
};

const DAY = 24 * 3600 * 1000;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
}

function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(d);
}

function yearsBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
}

function seniorityLabel(years: number): string {
  if (years < 1) return `${Math.round(years * 12)} mois`;
  return `${years.toFixed(1).replace(".", ",")} ans`;
}

export async function ManagerDashboard({ managerAgentId, firstName }: Props) {
  const service = await prisma.service.findUnique({
    where: { managerId: managerAgentId },
    select: { id: true, name: true, code: true },
  });

  if (!service) {
    return (
      <div className="rounded-xl border border-sc-warning/30 bg-sc-warning-light p-5 text-[13px] text-[#854f0b]">
        Vous êtes connecté en tant que Manager mais n&apos;avez encore aucun
        service à votre charge. Demandez à la Direction de vous affecter à un
        service depuis le menu Paramètres.
      </div>
    );
  }

  const today = new Date();
  const in60Days = new Date(today.getTime() + 60 * DAY);
  const currentMonth = today.getMonth();

  const [
    teamSize,
    perCount,
    patsCount,
    onLeaveToday,
    pendingApprovals,
    evalsTotal,
    evalsDone,
    evalsLate,
    teamMembers,
    expiringContracts,
    upcomingLeaves,
  ] = await Promise.all([
    prisma.agent.count({
      where: {
        serviceId: service.id,
        status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
      },
    }),
    prisma.agent.count({
      where: {
        serviceId: service.id,
        category: StaffCategory.PER,
        status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
      },
    }),
    prisma.agent.count({
      where: {
        serviceId: service.id,
        category: StaffCategory.PATS,
        status: { in: [AgentStatus.ACTIF, AgentStatus.SUSPENDU] },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.AUTORISE,
        startDate: { lte: today },
        endDate: { gte: today },
        agent: { serviceId: service.id },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.EN_ATTENTE,
        agent: { serviceId: service.id },
      },
    }),
    prisma.evaluation.count({
      where: { agent: { serviceId: service.id } },
    }),
    prisma.evaluation.count({
      where: {
        status: EvaluationStatus.TERMINEE,
        agent: { serviceId: service.id },
      },
    }),
    prisma.evaluation.count({
      where: {
        agent: { serviceId: service.id },
        status: { in: [EvaluationStatus.PLANIFIEE, EvaluationStatus.EN_COURS] },
        dueDate: { lt: today },
      },
    }),
    // Liste des membres de l'équipe (avec leur contrat actif)
    prisma.agent.findMany({
      where: { serviceId: service.id },
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        jobTitle: true,
        status: true,
        birthDate: true,
        hireDate: true,
        category: true,
        contracts: {
          where: { status: ContractStatus.ACTIF },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { type: true, endDate: true },
        },
      },
    }),
    // Contrats à échéance dans les 60 prochains jours
    prisma.contract.findMany({
      where: {
        status: ContractStatus.ACTIF,
        endDate: { gte: today, lte: in60Days },
        agent: { serviceId: service.id },
      },
      orderBy: { endDate: "asc" },
      include: {
        agent: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
      },
    }),
    // Congés approuvés à venir dans les 30 prochains jours
    prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.AUTORISE,
        startDate: { gte: today, lte: new Date(today.getTime() + 30 * DAY) },
        agent: { serviceId: service.id },
      },
      orderBy: { startDate: "asc" },
      take: 6,
      include: {
        agent: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const presenceRate =
    teamSize > 0
      ? Math.round(((teamSize - onLeaveToday) / teamSize) * 100)
      : 0;
  const evalPct =
    evalsTotal > 0 ? Math.round((evalsDone / evalsTotal) * 100) : 0;

  // Ancienneté moyenne (en années)
  const avgSeniority =
    teamMembers.length > 0
      ? teamMembers.reduce((s, a) => s + yearsBetween(a.hireDate, today), 0) /
        teamMembers.length
      : 0;

  // Anniversaires du mois courant
  const birthdays = teamMembers
    .filter((m) => m.birthDate && m.birthDate.getMonth() === currentMonth)
    .map((m) => ({
      id: m.id,
      name: `${m.lastName.toUpperCase()} ${m.firstName}`,
      day: m.birthDate!.getDate(),
      age: today.getFullYear() - m.birthDate!.getFullYear(),
    }))
    .sort((a, b) => a.day - b.day);

  // Pending leaves pour la table
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: LeaveStatus.EN_ATTENTE,
      agent: { serviceId: service.id },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    include: {
      agent: {
        select: { firstName: true, lastName: true, matricule: true, id: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Bandeau service */}
      <div className="rounded-xl border border-sc-border bg-gradient-to-r from-sc-blue-bg to-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">
          Service que vous dirigez
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-sc-blue-darker">
          {service.name}{" "}
          <span className="text-[14px] font-normal text-gray-500">
            · {service.code}
          </span>
        </h2>
        <p className="mt-2 text-[12.5px] text-gray-600">
          Bonjour {firstName}, voici la situation de votre équipe.
        </p>
      </div>

      {/* KPI première ligne */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="blue"
          icon="users"
          label="Effectif équipe"
          value={String(teamSize)}
          hint={`${perCount} PER · ${patsCount} PATS`}
        />
        <KpiCard
          color="teal"
          icon="evaluation"
          label="Taux de présence"
          value={`${presenceRate}%`}
          hint={`${onLeaveToday} en congé aujourd'hui`}
        />
        <KpiCard
          color="warning"
          icon="calendar"
          label="Congés à valider"
          value={String(pendingApprovals)}
          hint="En attente de votre décision"
        />
        <KpiCard
          color="purple"
          icon="evaluation"
          label="Évaluations"
          value={`${evalPct}%`}
          hint={`${evalsDone} / ${evalsTotal} réalisées`}
        />
      </div>

      {/* KPI deuxième ligne */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="blue"
          icon="info"
          label="Ancienneté moyenne"
          value={seniorityLabel(avgSeniority)}
          hint="Tous statuts confondus"
        />
        <KpiCard
          color="warning"
          icon="alert"
          label="Contrats à échéance"
          value={String(expiringContracts.length)}
          hint="Dans les 60 prochains jours"
        />
        <KpiCard
          color="danger"
          icon="alert"
          label="Évaluations en retard"
          value={String(evalsLate)}
          hint="Échéance dépassée"
        />
        <KpiCard
          color="green"
          icon="bell"
          label="Anniversaires"
          value={String(birthdays.length)}
          hint={birthdays.length > 0 ? "Ce mois-ci" : "Aucun ce mois"}
        />
      </div>

      {/* Composition + à valider côte à côte */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h3 className="mb-3 font-serif text-[15px] font-semibold text-sc-blue-darker">
            Composition de l&apos;équipe
          </h3>
          <CategoryDonut per={perCount} pats={patsCount} />
        </section>

        <section className="lg:col-span-2 rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
              <span className="h-[18px] w-1 rounded bg-sc-warning" />
              Demandes de congés à traiter
            </h3>
            <Link
              href="/conges"
              className="text-[12px] font-medium text-sc-blue hover:underline"
            >
              Tout voir →
            </Link>
          </div>

          {pendingLeaves.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-500">
              Aucune demande en attente. Bonne journée !
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-left">
                <tr className="border-b border-sc-border text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Période</th>
                  <th className="pb-2 text-right">Jours</th>
                </tr>
              </thead>
              <tbody>
                {pendingLeaves.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-sc-border/60 last:border-b-0"
                  >
                    <td className="py-2.5">
                      <Link
                        href={`/personnel/${l.agent.id}`}
                        className="font-medium text-sc-blue-darker hover:underline"
                      >
                        {l.agent.lastName.toUpperCase()} {l.agent.firstName}
                      </Link>
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {l.type.charAt(0) + l.type.slice(1).toLowerCase()}
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-gray-700">
                      {l.days}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>

      {/* Mon équipe — liste */}
      <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-blue" />
            Mon équipe ({teamMembers.length})
          </h3>
          <Link
            href={`/personnel?service=${service.id}`}
            className="text-[12px] font-medium text-sc-blue hover:underline"
          >
            Voir toutes les fiches →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {teamMembers.map((m) => {
            const initials = `${m.firstName[0]}${m.lastName[0]}`.toUpperCase();
            const years = yearsBetween(m.hireDate, today);
            const contract = m.contracts[0];
            const isInactive = m.status !== AgentStatus.ACTIF;
            return (
              <Link
                key={m.id}
                href={`/personnel/${m.id}`}
                className={`flex items-center gap-3 rounded-lg border border-sc-border bg-sc-blue-bg/30 p-2.5 transition hover:-translate-y-0.5 hover:border-sc-blue hover:bg-white ${
                  isInactive ? "opacity-60" : ""
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-[12px] font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-sc-blue-darker">
                    {m.lastName.toUpperCase()} {m.firstName}
                  </p>
                  <p className="truncate text-[11.5px] text-gray-600">
                    {m.jobTitle}
                  </p>
                  <p className="text-[10.5px] text-gray-500">
                    {seniorityLabel(years)} d&apos;ancienneté
                    {contract && ` · ${contract.type}`}
                  </p>
                </div>
                {isInactive && (
                  <span className="rounded-full bg-gray-200 px-2 py-[1px] text-[9.5px] font-semibold uppercase text-gray-600">
                    {m.status.toLowerCase()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Contrats à échéance + Anniversaires + Congés à venir */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-[15px] font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-warning" />
            Contrats à renouveler
          </h3>
          {expiringContracts.length === 0 ? (
            <p className="text-[12px] text-gray-400">
              Aucun contrat à échéance dans les 60 prochains jours.
            </p>
          ) : (
            <ul className="space-y-2">
              {expiringContracts.map((c) => {
                const daysLeft = Math.ceil(
                  ((c.endDate?.getTime() ?? 0) - today.getTime()) / DAY,
                );
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 border-b border-sc-border/60 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/personnel/${c.agent.id}`}
                        className="block truncate text-[12.5px] font-medium text-sc-blue-darker hover:underline"
                      >
                        {c.agent.lastName.toUpperCase()} {c.agent.firstName}
                      </Link>
                      <p className="text-[11px] text-gray-500">
                        {c.type} · échéance {formatDate(c.endDate!)}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-[1px] text-[10px] font-semibold uppercase ${
                        daysLeft <= 14
                          ? "bg-sc-danger-light text-sc-danger"
                          : daysLeft <= 30
                            ? "bg-sc-warning-light text-[#854f0b]"
                            : "bg-sc-blue-light text-sc-blue"
                      }`}
                    >
                      {daysLeft} j
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-[15px] font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-green" />
            Absences à venir
          </h3>
          {upcomingLeaves.length === 0 ? (
            <p className="text-[12px] text-gray-400">
              Aucune absence prévue dans les 30 prochains jours.
            </p>
          ) : (
            <ul className="space-y-2">
              {upcomingLeaves.map((l) => (
                <li
                  key={l.id}
                  className="border-b border-sc-border/60 pb-2 last:border-b-0 last:pb-0"
                >
                  <p className="text-[12.5px] font-medium text-sc-blue-darker">
                    {l.agent.lastName.toUpperCase()} {l.agent.firstName}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {l.type.charAt(0) + l.type.slice(1).toLowerCase()} ·{" "}
                    {formatDate(l.startDate)} → {formatDate(l.endDate)}{" "}
                    <span className="font-mono">({l.days} j)</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-[15px] font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-purple" />
            Anniversaires
          </h3>
          {birthdays.length === 0 ? (
            <p className="text-[12px] text-gray-400">
              Aucun anniversaire ce mois-ci.
            </p>
          ) : (
            <ul className="space-y-2">
              {birthdays.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 border-b border-sc-border/60 pb-2 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-[12.5px] font-medium text-sc-blue-darker">
                      🎂 {b.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatLongDate(new Date(today.getFullYear(), currentMonth, b.day))}{" "}
                      · {b.age} ans
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
