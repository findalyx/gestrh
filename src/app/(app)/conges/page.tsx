import Link from "next/link";
import { LeaveStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  getLeaveScopeWhere,
  getMyPendingApprovalsWhere,
} from "@/lib/leave-access";
import { Icon } from "@/components/Icon";
import {
  LeaveStatusBadge,
  LeaveTypeBadge,
} from "./_components/LeaveBadges";
import {
  ApproveButton,
  CancelButton,
  RejectButton,
} from "./_components/LeaveActions";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export default async function CongesPage() {
  const me = await getCurrentUser();
  const { where: scopeWhere, scope } = await getLeaveScopeWhere();
  const { where: pendingWhere, canApprove } = await getMyPendingApprovalsWhere();

  const [pending, recent] = await Promise.all([
    canApprove
      ? prisma.leaveRequest.findMany({
          where: pendingWhere,
          orderBy: { createdAt: "asc" },
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
          take: 50,
        })
      : Promise.resolve([]),
    prisma.leaveRequest.findMany({
      where: scopeWhere,
      orderBy: { createdAt: "desc" },
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
        approver: {
          select: { firstName: true, lastName: true },
        },
      },
      take: 100,
    }),
  ]);

  // Mon solde de congé annuel
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

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;

  return (
    <div className="space-y-6">
      {/* Bandeau d'en-tête : action + solde rapide */}
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

      {/* À valider */}
      {canApprove && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-warning" />
            À valider ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sc-border bg-white p-5 text-center text-[13px] text-gray-500">
              Aucune demande en attente de votre décision.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
              <table className="w-full text-[13px]">
                <thead className="bg-sc-blue-bg text-left">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Période</th>
                    <th className="px-4 py-3 text-right">Jours</th>
                    <th className="px-4 py-3">Motif</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id} className="border-t border-sc-border">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/personnel/${r.agent.id}`}
                          className="font-medium text-sc-blue-darker hover:underline"
                        >
                          {r.agent.lastName.toUpperCase()} {r.agent.firstName}
                        </Link>
                        <p className="text-[11px] text-gray-500">
                          {r.agent.service.name} · {r.agent.matricule}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <LeaveTypeBadge value={r.type} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.days}</td>
                      <td className="px-4 py-2.5 text-[12px] text-gray-600">
                        {r.reason ? (
                          <span className="line-clamp-2" title={r.reason}>
                            {r.reason}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <ApproveButton requestId={r.id} />
                          <RejectButton requestId={r.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Toutes les demandes (selon le scope) */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          {scope === "SELF"
            ? "Mes demandes"
            : scope === "TEAM"
              ? "Demandes de l'équipe"
              : "Toutes les demandes"}{" "}
          ({recent.length})
        </h3>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
            <Icon name="calendar" size={20} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">
              Aucune demande de congé enregistrée.
            </p>
            {me.agent && (
              <Link
                href="/conges/nouveau"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-sc-blue hover:underline"
              >
                + Soumettre votre première demande
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <table className="w-full text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  {scope !== "SELF" && <th className="px-4 py-3">Agent</th>}
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3 text-right">Jours</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Décidé par</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const isMine = r.agentId === me.agent?.id;
                  const canCancel =
                    isMine &&
                    (r.status === LeaveStatus.EN_ATTENTE_MANAGER ||
                      r.status === LeaveStatus.EN_ATTENTE_DRH ||
                      (r.status === LeaveStatus.APPROUVE && r.startDate > new Date()));
                  return (
                    <tr key={r.id} className="border-t border-sc-border">
                      {scope !== "SELF" && (
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/personnel/${r.agent.id}`}
                            className="font-medium text-sc-blue-darker hover:underline"
                          >
                            {r.agent.lastName.toUpperCase()} {r.agent.firstName}
                          </Link>
                          <p className="text-[11px] text-gray-500">
                            {r.agent.service.name}
                          </p>
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
                          {canCancel && <CancelButton requestId={r.id} />}
                          {/* L'admin peut aussi approuver/refuser ici si encore en attente */}
                          {isAdmin &&
                            !isMine &&
                            (r.status === LeaveStatus.EN_ATTENTE_DRH ||
                              r.status === LeaveStatus.EN_ATTENTE_MANAGER) && (
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
        )}
      </section>
    </div>
  );
}
