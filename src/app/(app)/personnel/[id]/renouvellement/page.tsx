import { notFound } from "next/navigation";
import {
  ContractStatus,
  ContractType,
  RenewalDecision,
} from "@prisma/client";
import { getAgentDetail } from "@/lib/personnel";
import { cddAlertLevel, daysUntil, formatDate } from "@/lib/contract-utils";
import {
  DecisionForm,
  NotifyButton,
  OpenRenewalButton,
} from "../../_components/RenewalWidget";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

const DECISION_LABEL: Record<RenewalDecision, string> = {
  EN_COURS: "Décision en cours",
  RENOUVELE: "Renouvelé",
  CONVERTI_CDI: "Converti en CDI",
  NON_RENOUVELE: "Non renouvelé",
};

const DECISION_STYLE: Record<RenewalDecision, string> = {
  EN_COURS: "bg-amber-100 text-amber-800",
  RENOUVELE: "bg-sc-green-light text-sc-green-dark",
  CONVERTI_CDI: "bg-sc-blue-light text-sc-blue",
  NON_RENOUVELE: "bg-sc-danger-light text-sc-danger",
};

export default async function RenewalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentDetail(id);
  if (!agent) notFound();

  const agentName = `${agent.lastName.toUpperCase()} ${agent.firstName}`;

  const renewals = agent.contracts
    .filter((c) => c.renewal)
    .map((c) => ({ renewal: c.renewal!, contract: c }));

  // Suggérer l'ouverture d'un dossier pour les CDD actifs sans renewal
  // dont l'échéance tombe dans les 90 jours.
  const candidates = agent.contracts.filter(
    (c) =>
      c.type === ContractType.CDD &&
      c.status === ContractStatus.ACTIF &&
      !c.renewal &&
      c.endDate &&
      cddAlertLevel(daysUntil(c.endDate)) !== "normal",
  );

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="renouvellement" agentName={agentName} />

      {renewals.length === 0 && candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12px] text-gray-500">
          Aucun CDD à échéance et aucun dossier de renouvellement ouvert pour cet
          agent. Un dossier peut être ouvert manuellement dès que l&apos;échéance
          d&apos;un CDD approche.
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((c) => {
            const d = daysUntil(c.endDate);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
              >
                <div>
                  <div className="font-semibold text-amber-900">
                    CDD {c.reference} à échéance
                    {d !== null && d >= 0
                      ? ` dans ${d} jour${d > 1 ? "s" : ""}`
                      : " (déjà échu)"}
                  </div>
                  <div className="text-[11px] text-amber-800">
                    Fin prévue : {formatDate(c.endDate)} · Aucun dossier de
                    renouvellement ouvert.
                  </div>
                </div>
                <OpenRenewalButton contractId={c.id} />
              </div>
            );
          })}

          {renewals.map(({ renewal, contract }) => (
            <div
              key={renewal.id}
              className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
                      Renouvellement · contrat {contract.reference}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${DECISION_STYLE[renewal.decision]}`}
                    >
                      {DECISION_LABEL[renewal.decision]}
                    </span>
                  </div>
                  {renewal.reason && (
                    <p className="mt-1 text-[12px] text-gray-700">{renewal.reason}</p>
                  )}
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  <div>Ouvert le {formatDate(renewal.createdAt)}</div>
                  {renewal.decidedAt && (
                    <div>Décision : {formatDate(renewal.decidedAt)}</div>
                  )}
                  {renewal.notifiedAt && (
                    <div>Agent notifié : {formatDate(renewal.notifiedAt)}</div>
                  )}
                </div>
              </div>

              {(renewal.newEndDate || renewal.newContractId) && (
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-md bg-sc-blue-bg p-3 text-[12px]">
                  {renewal.newEndDate && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Nouvelle fin
                      </div>
                      <div className="text-sc-blue-darker">
                        {formatDate(renewal.newEndDate)}
                      </div>
                    </div>
                  )}
                  {renewal.newContractId && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Nouveau contrat
                      </div>
                      <div className="text-sc-blue-darker">
                        {renewal.newContractId}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {renewal.decision === RenewalDecision.EN_COURS ? (
                <DecisionForm renewalId={renewal.id} />
              ) : (
                <NotifyButton
                  renewalId={renewal.id}
                  notified={Boolean(renewal.notifiedAt)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
