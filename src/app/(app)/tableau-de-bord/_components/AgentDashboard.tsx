import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  LeaveStatus,
  LeaveType,
  EvaluationStatus,
  EnrollmentStatus,
  type StaffCategory,
} from "@prisma/client";
import { CategoryBadge, AgentStatusBadge } from "@/components/Badges";
import { Icon, type IconName } from "@/components/Icon";
import {
  formatScore,
  perfCategory,
  PERF_LABEL,
  PERF_STYLE,
} from "@/lib/performance";
import { KpiCard } from "./KpiCard";

type Props = {
  agentId: string;
  firstName: string;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function daysUntil(d: Date): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUEL: "Congés annuels",
  MALADIE: "Maladie",
  MATERNITE: "Maternité",
  PATERNITE: "Paternité",
  EXCEPTIONNEL: "Exceptionnel",
  SANS_SOLDE: "Sans solde",
};

const LEAVE_TYPE_ICON: Record<LeaveType, IconName> = {
  ANNUEL: "calendar",
  MALADIE: "alert",
  MATERNITE: "users",
  PATERNITE: "users",
  EXCEPTIONNEL: "info",
  SANS_SOLDE: "calendar",
};

const LEAVE_TYPE_COLOR: Record<LeaveType, string> = {
  ANNUEL: "bg-sc-teal-light text-sc-teal-dark",
  MALADIE: "bg-sc-danger-light text-sc-danger",
  MATERNITE: "bg-sc-purple-light text-sc-purple",
  PATERNITE: "bg-sc-purple-light text-sc-purple",
  EXCEPTIONNEL: "bg-sc-warning-light text-[#854f0b]",
  SANS_SOLDE: "bg-gray-100 text-gray-600",
};

const FCFA = new Intl.NumberFormat("fr-FR");

export async function AgentDashboard({ agentId, firstName }: Props) {
  const currentYear = new Date().getFullYear();

  const [
    agent,
    balances,
    upcomingLeaves,
    evaluations,
    enrollments,
    lastPayroll,
  ] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: agentId },
      include: { service: { select: { name: true, code: true } } },
    }),
    prisma.leaveBalance.findMany({
      where: { agentId, year: currentYear },
      orderBy: { type: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        agentId,
        status: {
          in: [
            LeaveStatus.EN_ATTENTE_CHEF,
            LeaveStatus.EN_ATTENTE_DOYEN,
            LeaveStatus.EN_ATTENTE_DG,
            LeaveStatus.AUTORISE,
          ],
        },
        endDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      take: 3,
    }),
    prisma.evaluation.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, status: true, period: true, overallScore: true, dueDate: true },
    }),
    prisma.trainingEnrollment.findMany({
      where: {
        agentId,
        status: { in: [EnrollmentStatus.INSCRIT, EnrollmentStatus.CONFIRME] },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        session: {
          include: { course: { select: { title: true, category: true } } },
        },
      },
    }),
    prisma.payrollRecord.findFirst({
      where: { agentId },
      orderBy: { period: "desc" },
    }),
  ]);

  if (!agent) {
    return (
      <div className="rounded-xl border border-sc-warning/30 bg-sc-warning-light p-5 text-[13px] text-[#854f0b]">
        Votre fiche agent est introuvable. Contactez la DRH.
      </div>
    );
  }

  const initials = `${agent.firstName[0]}${agent.lastName[0]}`.toUpperCase();
  const evalsDone = evaluations.filter(
    (e) => e.status === EvaluationStatus.TERMINEE,
  ).length;
  const nextLeave = upcomingLeaves[0];
  const nextLeaveDays = nextLeave ? daysUntil(nextLeave.startDate) : null;

  // KPI calculés
  const annualBalance = balances.find((b) => b.type === LeaveType.ANNUEL);
  const annualRemaining = annualBalance
    ? annualBalance.totalDays - annualBalance.usedDays
    : null;
  const annualTotal = annualBalance?.totalDays ?? null;

  const seniorityYears =
    (Date.now() - agent.hireDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  const seniorityLabel =
    seniorityYears < 1
      ? `${Math.round(seniorityYears * 12)} mois`
      : `${seniorityYears.toFixed(1).replace(".", ",")} ans`;

  const upcomingTrainingsCount = enrollments.length;

  // Sous-titre contextuel
  const subline = (() => {
    if (nextLeaveDays !== null) {
      if (nextLeaveDays < 0) return "Vous êtes actuellement en congé. Bon repos.";
      if (nextLeaveDays === 0) return "Votre congé commence aujourd'hui.";
      if (nextLeaveDays === 1) return "Votre prochain congé commence demain.";
      if (nextLeaveDays <= 30)
        return `Prochain congé dans ${nextLeaveDays} jour${nextLeaveDays > 1 ? "s" : ""}.`;
    }
    return "Voici votre espace personnel.";
  })();

  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue */}
      <div className="overflow-hidden rounded-xl border border-sc-border bg-gradient-to-br from-sc-blue-darker via-sc-blue to-sc-purple text-white shadow-[0_4px_20px_rgba(51,89,164,0.15)]">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold ring-2 ring-white/30 backdrop-blur">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] uppercase tracking-wider text-white/70">
              {greeting()}
            </p>
            <h2 className="font-serif text-2xl font-semibold leading-tight">
              {firstName} {agent.lastName}
            </h2>
            <p className="mt-1 text-[13px] text-white/80">
              {agent.jobTitle} · {agent.service.name}
            </p>
            <p className="mt-0.5 text-[12px] text-white/60">{subline}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              <CategoryBadge value={agent.category as StaffCategory} />
              <AgentStatusBadge value={agent.status} />
            </div>
            <Link
              href={`/personnel/${agent.id}`}
              className="rounded-lg border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              Voir mon dossier →
            </Link>
          </div>
        </div>
      </div>

      {/* KPI personnels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          color="green"
          icon="calendar"
          label="Congés annuels"
          value={annualRemaining !== null ? `${annualRemaining} j` : "—"}
          hint={
            annualTotal !== null
              ? `restants sur ${annualTotal}`
              : "Aucun solde enregistré"
          }
        />
        <KpiCard
          color="purple"
          icon="payroll"
          label="Dernier salaire net"
          value={
            lastPayroll
              ? `${FCFA.format(lastPayroll.netSalary)}`
              : "—"
          }
          hint={
            lastPayroll
              ? `FCFA · Période ${lastPayroll.period}`
              : "Aucun bulletin"
          }
        />
        <KpiCard
          color="teal"
          icon="training"
          label="Formations à venir"
          value={String(upcomingTrainingsCount)}
          hint={
            upcomingTrainingsCount > 0
              ? "Inscrites ou confirmées"
              : "Aucune planifiée"
          }
        />
        <KpiCard
          color="blue"
          icon="users"
          label="Ancienneté"
          value={seniorityLabel}
          hint={`Embauché le ${formatDate(agent.hireDate)}`}
        />
      </div>

      {/* Soldes de congés */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-green" />
          Mes soldes de congés {currentYear}
        </h3>
        {balances.length === 0 ? (
          <EmptyState
            icon="calendar"
            text={`Aucun solde enregistré pour ${currentYear}.`}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => {
              const remaining = b.totalDays - b.usedDays;
              const pct =
                b.totalDays > 0
                  ? Math.min(100, Math.round((b.usedDays / b.totalDays) * 100))
                  : 0;
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${LEAVE_TYPE_COLOR[b.type]}`}
                    >
                      <Icon name={LEAVE_TYPE_ICON[b.type]} size={15} />
                    </div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-600">
                      {LEAVE_TYPE_LABEL[b.type]}
                    </p>
                  </div>
                  <p className="mt-3 font-serif text-3xl font-bold leading-none text-sc-blue-darker">
                    {remaining}
                    <span className="ml-1 text-[12px] font-normal text-gray-500">
                      / {b.totalDays} j
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-sc-teal transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    {b.usedDays} jour(s) utilisé(s) · {100 - pct}% restant
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grille principale : 3 colonnes sur grand écran */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Mes prochaines absences */}
        <Card
          icon="calendar"
          accent="bg-sc-green"
          title="Prochaines absences"
        >
          {upcomingLeaves.length === 0 ? (
            <EmptyState icon="calendar" text="Aucune absence prévue." inline />
          ) : (
            <ul className="space-y-3">
              {upcomingLeaves.map((l) => (
                <li key={l.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-sc-blue-darker">
                      {LEAVE_TYPE_LABEL[l.type]}
                    </p>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-[1.5px] text-[10px] font-semibold uppercase tracking-wider ${
                        l.status === LeaveStatus.AUTORISE
                          ? "bg-sc-green-light text-sc-green-dark"
                          : "bg-sc-warning-light text-[#854f0b]"
                      }`}
                    >
                      {l.status === LeaveStatus.AUTORISE
                        ? "Approuvé"
                        : "En attente"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-gray-500">
                    {formatDate(l.startDate)} → {formatDate(l.endDate)} ·{" "}
                    <span className="font-mono">{l.days} j</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Mon dernier bulletin */}
        <Card icon="payroll" accent="bg-sc-purple" title="Dernier bulletin">
          {!lastPayroll ? (
            <EmptyState icon="payroll" text="Aucun bulletin." inline />
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500">
                  Période {lastPayroll.period}
                </p>
                <p className="mt-0.5 font-serif text-2xl font-bold leading-tight text-sc-blue-darker">
                  {FCFA.format(lastPayroll.netSalary)}{" "}
                  <span className="text-[11px] font-normal text-gray-500">
                    FCFA net
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="rounded-lg bg-sc-blue-bg px-2.5 py-1.5">
                  <p className="text-gray-500">Base</p>
                  <p className="font-mono font-semibold text-sc-blue-darker">
                    {FCFA.format(lastPayroll.baseSalary)}
                  </p>
                </div>
                <div className="rounded-lg bg-sc-blue-bg px-2.5 py-1.5">
                  <p className="text-gray-500">Primes</p>
                  <p className="font-mono font-semibold text-sc-blue-darker">
                    {FCFA.format(lastPayroll.bonuses)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Mes formations */}
        <Card icon="training" accent="bg-sc-teal" title="Formations à venir">
          {enrollments.length === 0 ? (
            <EmptyState icon="training" text="Aucune formation prévue." inline />
          ) : (
            <ul className="space-y-3">
              {enrollments.map((e) => (
                <li key={e.id}>
                  <p className="text-[13px] font-medium text-sc-blue-darker leading-snug">
                    {e.session.course.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {e.session.course.category} · {formatDate(e.session.startDate)}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-[1.5px] text-[10px] font-semibold uppercase tracking-wider ${
                      e.status === EnrollmentStatus.CONFIRME
                        ? "bg-sc-green-light text-sc-green-dark"
                        : "bg-sc-blue-light text-sc-blue"
                    }`}
                  >
                    {e.status === EnrollmentStatus.CONFIRME
                      ? "Confirmé"
                      : "Inscrit"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Évaluations — pleine largeur en bas */}
      {evaluations.length > 0 && (
        <Card icon="evaluation" accent="bg-sc-purple" title="Mes évaluations">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {evaluations.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-sc-border bg-sc-blue-bg/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-sc-blue-darker">
                    Période {e.period}
                  </p>
                  <span
                    className={`rounded-full px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wider ${
                      e.status === EvaluationStatus.TERMINEE
                        ? "bg-sc-green-light text-sc-green-dark"
                        : e.status === EvaluationStatus.EN_RETARD
                          ? "bg-sc-danger-light text-sc-danger"
                          : "bg-sc-warning-light text-[#854f0b]"
                    }`}
                  >
                    {e.status.replace("_", " ").toLowerCase()}
                  </span>
                </div>
                {e.overallScore !== null && (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-serif text-lg font-semibold text-sc-blue-darker">
                      {formatScore(e.overallScore)}{" "}
                      <span className="text-[11px] text-gray-500">/20</span>
                    </p>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                        PERF_STYLE[perfCategory(e.overallScore)]
                      }`}
                    >
                      {PERF_LABEL[perfCategory(e.overallScore)]}
                    </span>
                  </div>
                )}
                {e.dueDate && (
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Échéance : {formatDate(e.dueDate)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-gray-600">
            {evalsDone} évaluation(s) terminée(s) sur {evaluations.length}.
          </p>
        </Card>
      )}

      {/* Actions rapides — en bas */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          Actions rapides
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <QuickAction
            href="/conges"
            icon="calendar"
            label="Demander un congé"
            color="green"
          />
          <QuickAction
            href="/paie"
            icon="payroll"
            label="Mes bulletins"
            color="purple"
          />
          <QuickAction
            href="/formation"
            icon="training"
            label="Mes formations"
            color="teal"
          />
          <QuickAction
            href="/evaluation"
            icon="evaluation"
            label="Mes évaluations"
            color="blue"
          />
        </div>
      </section>
    </div>
  );
}

// ============================================================
//  Composants internes
// ============================================================

const QUICK_ACTION_STYLE: Record<string, string> = {
  blue: "from-sc-blue-light to-white text-sc-blue hover:border-sc-blue",
  purple: "from-sc-purple-light to-white text-sc-purple hover:border-sc-purple",
  green: "from-sc-green-light to-white text-sc-green-dark hover:border-sc-green",
  teal: "from-sc-teal-light to-white text-sc-teal-dark hover:border-sc-teal",
};

function QuickAction({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: IconName;
  label: string;
  color: "blue" | "purple" | "green" | "teal";
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border border-sc-border bg-gradient-to-br ${QUICK_ACTION_STYLE[color]} p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon name={icon} size={16} />
      </span>
      <span className="text-[13px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

function Card({
  icon,
  accent,
  title,
  children,
}: {
  icon: IconName;
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <header className="mb-4 flex items-center gap-2.5">
        <span className={`h-[18px] w-1 rounded ${accent}`} />
        <Icon name={icon} size={14} className="text-gray-400" />
        <h3 className="font-serif text-[15px] font-semibold text-sc-blue-darker">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );
}

function EmptyState({
  icon,
  text,
  inline,
}: {
  icon: IconName;
  text: string;
  inline?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 text-[12.5px] text-gray-500 ${
        inline ? "py-2" : "rounded-xl border border-dashed border-sc-border bg-white px-4 py-6 justify-center"
      }`}
    >
      <Icon name={icon} size={16} className="text-gray-400" />
      {text}
    </div>
  );
}
