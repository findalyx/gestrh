import { notFound } from "next/navigation";
import { ContractStatus, ResignationStatus } from "@prisma/client";
import { getAgentDetail } from "@/lib/personnel";
import { formatDate } from "@/lib/contract-utils";
import {
  CancelResignationButton,
  DecisionForm,
  MarkEffectiveButton,
  SubmitResignationForm,
  UploadSignedLetter,
} from "../../_components/ResignationWidgets";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ResignationStatus, string> = {
  SOUMISE: "Soumise — en attente DRH",
  ACCUSEE: "Accusée par la DRH",
  ACCEPTEE: "Acceptée — préavis en cours",
  REJETEE: "Refusée par la DRH",
  EN_PREAVIS: "En période de préavis",
  EFFECTIVE: "Effective — contrat rompu",
  ANNULEE: "Annulée",
};

const STATUS_STYLE: Record<ResignationStatus, string> = {
  SOUMISE: "bg-amber-100 text-amber-800",
  ACCUSEE: "bg-sc-blue-light text-sc-blue",
  ACCEPTEE: "bg-sc-green-light text-sc-green-dark",
  REJETEE: "bg-sc-danger-light text-sc-danger",
  EN_PREAVIS: "bg-sc-purple-light text-sc-purple",
  EFFECTIVE: "bg-gray-200 text-gray-700",
  ANNULEE: "bg-gray-100 text-gray-500",
};

export default async function ResignationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentDetail(id);
  if (!agent) notFound();

  const agentName = `${agent.lastName.toUpperCase()} ${agent.firstName}`;
  const activeContract = agent.contracts.find(
    (c) => c.status === ContractStatus.ACTIF,
  );
  const allResignations = agent.contracts
    .filter((c) => c.resignation)
    .map((c) => ({ resignation: c.resignation!, contract: c }));

  const liveResignation = allResignations.find(
    ({ resignation }) =>
      resignation.status !== ResignationStatus.REJETEE &&
      resignation.status !== ResignationStatus.ANNULEE &&
      resignation.status !== ResignationStatus.EFFECTIVE,
  );
  const archivedResignations = allResignations.filter(
    ({ resignation }) =>
      resignation.status === ResignationStatus.REJETEE ||
      resignation.status === ResignationStatus.ANNULEE ||
      resignation.status === ResignationStatus.EFFECTIVE,
  );

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="demission" agentName={agentName} />
      <div className="space-y-4">
        {/* Soumission possible si pas de démission active */}
        {!liveResignation && activeContract && (
          <SubmitResignationForm
            contractId={activeContract.id}
            contractReference={activeContract.reference}
            defaultNoticeDays={activeContract.noticePeriodDays}
          />
        )}
        {!liveResignation && !activeContract && allResignations.length === 0 && (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12px] text-gray-500">
            Cet agent n&apos;a pas de contrat actif pouvant faire l&apos;objet
            d&apos;une démission.
          </div>
        )}

        {liveResignation && (
          <ResignationCard
            resignation={liveResignation.resignation}
            contractRef={liveResignation.contract.reference}
          />
        )}

        {archivedResignations.length > 0 && (
          <div className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <div className="border-b border-sc-border px-5 py-3">
              <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
                Historique
              </h3>
            </div>
            <ul className="divide-y divide-sc-border">
              {archivedResignations.map(({ resignation, contract }) => (
                <li key={resignation.id} className="px-5 py-3 text-[12px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sc-blue-darker">
                        {contract.reference}
                      </span>
                      <span className="ml-2 text-gray-500">
                        Soumise le {formatDate(resignation.submittedAt)}
                        {resignation.decidedAt
                          ? ` · clôturée le ${formatDate(resignation.decidedAt)}`
                          : ""}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[resignation.status]}`}
                    >
                      {STATUS_LABEL[resignation.status]}
                    </span>
                  </div>
                  {resignation.reason && (
                    <p className="mt-1 text-gray-700">Motif : {resignation.reason}</p>
                  )}
                  {resignation.hrComment && (
                    <p className="mt-1 text-gray-700">
                      Commentaire DRH : {resignation.hrComment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
//  Carte dossier actif
// ---------------------------------------------------------------

function ResignationCard({
  resignation,
  contractRef,
}: {
  resignation: {
    id: string;
    status: ResignationStatus;
    submittedAt: Date;
    effectiveDate: Date;
    noticeStartDate: Date | null;
    decidedAt: Date | null;
    reason: string | null;
    hrComment: string | null;
    signedFileName: string | null;
  };
  contractRef: string;
}) {
  const showDecisionForm = resignation.status === ResignationStatus.SOUMISE;
  const showCancel = resignation.status === ResignationStatus.SOUMISE;
  const showUploadSigned =
    resignation.status === ResignationStatus.ACCEPTEE ||
    resignation.status === ResignationStatus.EN_PREAVIS;
  const showMarkEffective =
    resignation.status === ResignationStatus.ACCEPTEE &&
    Boolean(resignation.signedFileName);

  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
              Démission · contrat {contractRef}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[resignation.status]}`}
            >
              {STATUS_LABEL[resignation.status]}
            </span>
          </div>
          {resignation.reason && (
            <p className="mt-1 text-[12px] text-gray-700">
              <span className="font-semibold">Motif : </span>
              {resignation.reason}
            </p>
          )}
          {resignation.hrComment && (
            <p className="mt-1 text-[12px] text-gray-700">
              <span className="font-semibold">Commentaire DRH : </span>
              {resignation.hrComment}
            </p>
          )}
        </div>
        <div className="text-right text-[11px] text-gray-500">
          <div>Soumise le {formatDate(resignation.submittedAt)}</div>
          {resignation.decidedAt && (
            <div>Décision : {formatDate(resignation.decidedAt)}</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-md bg-sc-blue-bg p-3 text-[12px] md:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Date de départ
          </div>
          <div className="text-sc-blue-darker">
            {formatDate(resignation.effectiveDate)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Début préavis
          </div>
          <div className="text-sc-blue-darker">
            {resignation.noticeStartDate
              ? formatDate(resignation.noticeStartDate)
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Lettre signée
          </div>
          <div className="text-sc-blue-darker">
            {resignation.signedFileName ?? "Non déposée"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`/api/resignations/${resignation.id}/draft`}
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
        >
          Télécharger le brouillon (.docx)
        </a>
        {resignation.signedFileName && (
          <a
            href={`/api/resignations/${resignation.id}/signed`}
            className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
          >
            Voir la lettre signée
          </a>
        )}
        {showCancel && <CancelResignationButton resignationId={resignation.id} />}
      </div>

      {showDecisionForm && <DecisionForm resignationId={resignation.id} />}
      {showUploadSigned && (
        <div className="mt-3">
          <UploadSignedLetter
            resignationId={resignation.id}
            alreadyUploaded={Boolean(resignation.signedFileName)}
          />
        </div>
      )}
      {showMarkEffective && (
        <div className="mt-3">
          <MarkEffectiveButton resignationId={resignation.id} />
        </div>
      )}
    </div>
  );
}
