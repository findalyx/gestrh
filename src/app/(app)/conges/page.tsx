import Link from "next/link";
import { LeaveStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getLeaveScopeWhere, getMyPendingApprovalsWhere } from "@/lib/leave-access";
import { Icon } from "@/components/Icon";
import { LeaveStatusBadge, LeaveTypeBadge } from "./_components/LeaveBadges";
import { ApproveButton, CancelButton, RejectButton } from "./_components/LeaveActions";

export const dynamic = "force-dynamic";

const PENDING_STATUSES: LeaveStatus[] = [
  LeaveStatus.EN_ATTENTE_CHEF,
  LeaveStatus.EN_ATTENTE_DOYEN,
  LeaveStatus.EN_ATTENTE_DG,
];

const requestInclude = {
  agent: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      service: { select: { name: true } },
    },
  },
  approver: { select: { firstName: true, lastName: true } },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;
type Vue = "cours" | "valides" | "soldes";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

// ============================================================
//  Barre d'onglets
// ============================================================
function ViewTabs({ vue }: { vue: Vue }) {
  const tabs: { key: Vue; label: string; href: string }[] = [
    { key: "cours", label: "Demandes en cours", href: "/conges" },
    { key: "valides", label: "Congés validés", href: "/conges?vue=valides" },
    { key: "soldes", label: "Soldes de congés", href: "/conges?vue=soldes" },
  ];
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-sc-border bg-white p-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={
            vue === t.key
              ? "rounded-md bg-sc-blue px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm"
              : "rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-sc-blue-darker transition hover:bg-sc-blue-light"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// ============================================================
//  Tableau réutilisable des demandes (statut + actions)
// ============================================================
function RequestsTable({
  rows,
  showAgent,
  meAgentId,
  isAdmin,
  emptyMessage,
}: {
  rows: LeaveRow[];
  showAgent: boolean;
  meAgentId: string | null;
  isAdmin: boolean;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[13px] text-gray-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="bg-sc-blue-bg text-left">
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
            {showAgent && <th className="px-4 py-3">Agent</th>}
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Période</th>
            <th className="px-4 py-3 text-right">Jours</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Décidé par</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isMine = r.agentId === meAgentId;
            const canCancel =
              isMine &&
              (PENDING_STATUSES.includes(r.status) ||
                (r.status === LeaveStatus.AUTORISE && r.startDate > new Date()));
            return (
              <tr key={r.id} className="border-t border-sc-border">
                {showAgent && (
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/personnel/${r.agent.id}`}
                      className="font-medium text-sc-blue-darker hover:underline"
                    >
                      {r.agent.lastName.toUpperCase()} {r.agent.firstName}
                    </Link>
                    <p className="text-[11px] text-gray-500">{r.agent.service.name}</p>
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <LeaveTypeBadge value={r.type} />
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{r.days}</td>
                <td className="px-4 py-2.5">
                  <LeaveStatusBadge value={r.status} />
                </td>
                <td className="px-4 py-2.5 text-[12px] text-gray-600">
                  {r.approver
                    ? `${r.approver.firstName} ${r.approver.lastName.charAt(0)}.`
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {r.status === LeaveStatus.AUTORISE && (
                      <>
                        <a
                          href={`/api/conges/${r.id}/attestation`}
                          className="text-[12px] font-medium text-sc-blue hover:underline"
                        >
                          📄 Congés
                        </a>
                        <a
                          href={`/api/conges/${r.id}/attestation-reprise`}
                          className="text-[12px] font-medium text-sc-blue hover:underline"
                        >
                          📄 Reprise
                        </a>
                      </>
                    )}
                    {canCancel && <CancelButton requestId={r.id} />}
                    {isAdmin && !isMine && PENDING_STATUSES.includes(r.status) && (
                      <>
                        <ApproveButton requestId={r.id} />
                        <RejectButton requestId={r.id} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
//  Page
// ============================================================
export default async function CongesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const sp = await searchParams;
  const vue: Vue =
    sp.vue === "valides" ? "valides" : sp.vue === "soldes" ? "soldes" : "cours";

  const me = await getCurrentUser();
  const { where: scopeWhere, scope } = await getLeaveScopeWhere();
  const { where: pendingWhere, canApprove } = await getMyPendingApprovalsWhere();
  const meAgentId = me.agent?.id ?? null;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const currentYear = new Date().getFullYear();

  const myAnnualBalance = me.agent
    ? await prisma.leaveBalance.findUnique({
        where: {
          agentId_year_type: {
            agentId: me.agent.id,
            year: currentYear,
            type: "ANNUEL",
          },
        },
      })
    : null;

  return (
    <div className="space-y-5">
      {/* En-tête : action + solde rapide */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-gray-600">
            {scope === "ALL" && "Vue d'ensemble — toutes les demandes de l'établissement."}
            {scope === "TEAM" && "Demandes de votre équipe et vos propres demandes."}
            {scope === "SELF" && "Vos demandes de congés et soldes."}
          </p>
          {myAnnualBalance && (
            <p className="mt-1 text-[12px] text-gray-500">
              Solde annuel {currentYear} :{" "}
              <span className="font-semibold text-sc-blue-darker">
                {myAnnualBalance.totalDays - myAnnualBalance.usedDays} j restants
              </span>{" "}
              sur {myAnnualBalance.totalDays}
            </p>
          )}
        </div>
        {me.agent && (
          <Link
            href="/conges/nouveau"
            className="inline-flex items-center gap-2 rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
          >
            <span className="text-base leading-none">+</span> Nouvelle demande
          </Link>
        )}
      </div>

      <ViewTabs vue={vue} />

      {vue === "soldes" ? (
        <SoldesView
          scope={scope}
          meAgentId={meAgentId}
          currentYear={currentYear}
          myAnnualBalance={myAnnualBalance}
        />
      ) : vue === "valides" ? (
        <ValidesView scopeWhere={scopeWhere} scope={scope} meAgentId={meAgentId} isAdmin={isAdmin} />
      ) : (
        <CoursView
          scopeWhere={scopeWhere}
          scope={scope}
          meAgentId={meAgentId}
          isAdmin={isAdmin}
          canApprove={canApprove}
          pendingWhere={pendingWhere}
          hasAgent={Boolean(me.agent)}
        />
      )}
    </div>
  );
}

// ============================================================
//  Vue « Demandes en cours » (par défaut) : à valider + en cours
//  + derniers congés validés
// ============================================================
async function CoursView({
  scopeWhere,
  scope,
  meAgentId,
  isAdmin,
  canApprove,
  pendingWhere,
  hasAgent,
}: {
  scopeWhere: Prisma.LeaveRequestWhereInput;
  scope: "ALL" | "TEAM" | "SELF";
  meAgentId: string | null;
  isAdmin: boolean;
  canApprove: boolean;
  pendingWhere: Prisma.LeaveRequestWhereInput;
  hasAgent: boolean;
}) {
  const [toValidate, enCours, recentValides] = await Promise.all([
    canApprove
      ? prisma.leaveRequest.findMany({
          where: pendingWhere,
          orderBy: { createdAt: "asc" },
          include: requestInclude,
          take: 50,
        })
      : Promise.resolve([] as LeaveRow[]),
    prisma.leaveRequest.findMany({
      where: { AND: [scopeWhere, { status: { in: PENDING_STATUSES } }] },
      orderBy: { createdAt: "desc" },
      include: requestInclude,
      take: 100,
    }),
    prisma.leaveRequest.findMany({
      where: { AND: [scopeWhere, { status: LeaveStatus.AUTORISE }] },
      orderBy: { decidedAt: "desc" },
      include: requestInclude,
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      {canApprove && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-warning" />
            À valider par vous ({toValidate.length})
          </h3>
          <RequestsTable
            rows={toValidate}
            showAgent
            meAgentId={meAgentId}
            isAdmin={isAdmin}
            emptyMessage="Aucune demande en attente de votre décision."
          />
        </section>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-blue" />
          Demandes en cours ({enCours.length})
        </h3>
        {enCours.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
            <Icon name="calendar" size={20} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">
              Aucune demande de congé en cours.
            </p>
            {hasAgent && (
              <Link
                href="/conges/nouveau"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-sc-blue hover:underline"
              >
                + Soumettre une demande
              </Link>
            )}
          </div>
        ) : (
          <RequestsTable
            rows={enCours}
            showAgent={scope !== "SELF"}
            meAgentId={meAgentId}
            isAdmin={isAdmin}
            emptyMessage="Aucune demande en cours."
          />
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-green" />
          Derniers congés validés
        </h3>
        <RequestsTable
          rows={recentValides}
          showAgent={scope !== "SELF"}
          meAgentId={meAgentId}
          isAdmin={isAdmin}
          emptyMessage="Aucun congé validé pour l'instant."
        />
      </section>
    </div>
  );
}

// ============================================================
//  Vue « Congés validés »
// ============================================================
async function ValidesView({
  scopeWhere,
  scope,
  meAgentId,
  isAdmin,
}: {
  scopeWhere: Prisma.LeaveRequestWhereInput;
  scope: "ALL" | "TEAM" | "SELF";
  meAgentId: string | null;
  isAdmin: boolean;
}) {
  const valides = await prisma.leaveRequest.findMany({
    where: { AND: [scopeWhere, { status: LeaveStatus.AUTORISE }] },
    orderBy: { startDate: "desc" },
    include: requestInclude,
    take: 200,
  });
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
        <span className="h-[18px] w-1 rounded bg-sc-green" />
        Congés validés ({valides.length})
      </h3>
      <RequestsTable
        rows={valides}
        showAgent={scope !== "SELF"}
        meAgentId={meAgentId}
        isAdmin={isAdmin}
        emptyMessage="Aucun congé validé."
      />
    </section>
  );
}

// ============================================================
//  Vue « Soldes de congés »
// ============================================================
async function SoldesView({
  scope,
  meAgentId,
  currentYear,
  myAnnualBalance,
}: {
  scope: "ALL" | "TEAM" | "SELF";
  meAgentId: string | null;
  currentYear: number;
  myAnnualBalance: { totalDays: number; usedDays: number } | null;
}) {
  if (scope === "SELF") {
    return (
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-green" />
          Mon solde {currentYear}
        </h3>
        {myAnnualBalance ? (
          <div className="rounded-xl border border-sc-border bg-white p-5 text-[13px] shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <span className="font-semibold text-sc-blue-darker">
              {myAnnualBalance.totalDays - myAnnualBalance.usedDays} jours restants
            </span>{" "}
            sur {myAnnualBalance.totalDays} (pris : {myAnnualBalance.usedDays}).
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[13px] text-gray-500">
            Aucun solde de congé annuel enregistré.
          </div>
        )}
      </section>
    );
  }

  const agentBalanceFilter: Prisma.AgentWhereInput | undefined =
    scope === "ALL"
      ? undefined
      : meAgentId
        ? { OR: [{ id: meAgentId }, { service: { managerId: meAgentId } }] }
        : { id: "__none__" };

  const balances = await prisma.leaveBalance.findMany({
    where: { year: currentYear, type: "ANNUEL", agent: agentBalanceFilter },
    include: {
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          service: { select: { name: true } },
        },
      },
    },
    orderBy: [{ agent: { lastName: "asc" } }],
    take: 500,
  });

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
        <span className="h-[18px] w-1 rounded bg-sc-green" />
        Soldes de congés {currentYear} ({balances.length})
      </h3>
      {balances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[13px] text-gray-500">
          Aucun solde enregistré.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">Acquis</th>
                <th className="px-4 py-3 text-right">Pris</th>
                <th className="px-4 py-3 text-right">Restant</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const remaining = b.totalDays - b.usedDays;
                return (
                  <tr key={b.id} className="border-t border-sc-border">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/personnel/${b.agent.id}`}
                        className="font-medium text-sc-blue-darker hover:underline"
                      >
                        {b.agent.lastName.toUpperCase()} {b.agent.firstName}
                      </Link>
                      <span className="ml-1 font-mono text-[10.5px] text-gray-400">
                        {b.agent.matricule}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{b.agent.service.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{b.totalDays}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{b.usedDays}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        remaining <= 0 ? "text-sc-danger" : "text-sc-green-dark"
                      }`}
                    >
                      {remaining}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
