import { notFound } from "next/navigation";
import { AmendmentType, ContractStatus } from "@prisma/client";
import { getAgentDetail } from "@/lib/personnel";
import { formatDate } from "@/lib/contract-utils";
import {
  DeleteAmendmentButton,
  NewAmendmentButton,
  UploadSignedAmendment,
} from "../../_components/AmendmentWidgets";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

const AMENDMENT_LABEL: Record<AmendmentType, string> = {
  SALAIRE: "Modification de salaire",
  GRADE: "Changement de grade",
  FONCTION: "Changement de fonction",
  HORAIRES: "Modification d'horaires",
  MUTATION: "Mutation",
  AUTRE: "Autre",
};

export default async function AgentAmendmentsPage({
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
  const amendments = agent.contracts.flatMap((c) =>
    c.amendments.map((a) => ({ amendment: a, contractRef: c.reference })),
  );

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="avenants" agentName={agentName} />
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div>
            <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
              Avenants
            </h3>
            <p className="text-[11px] text-gray-500">
              {amendments.length} avenant{amendments.length > 1 ? "s" : ""} sur ce
              dossier
            </p>
          </div>
          {activeContract && (
            <NewAmendmentButton
              contractId={activeContract.id}
              contractReference={activeContract.reference}
            />
          )}
        </div>

        {amendments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12px] text-gray-500">
            Aucun avenant. Utilisez le bouton ci-dessus pour acter une
            modification contractuelle.
          </div>
        ) : (
          <ul className="space-y-3">
            {amendments.map(({ amendment, contractRef }) => (
              <li
                key={amendment.id}
                className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sc-blue-darker">
                        {amendment.reference}
                      </span>
                      <span className="rounded bg-sc-purple-light px-2 py-0.5 text-[11px] font-semibold text-sc-purple">
                        {AMENDMENT_LABEL[amendment.type]}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Contrat {contractRef}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-gray-700">
                      {amendment.description}
                    </p>
                    {(amendment.oldValue || amendment.newValue) && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {amendment.oldValue ?? "—"} →{" "}
                        <strong>{amendment.newValue ?? "—"}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-gray-500">
                    <div>Effet : {formatDate(amendment.effectiveDate)}</div>
                    <div>
                      {amendment.signedAt
                        ? `Signé le ${formatDate(amendment.signedAt)}`
                        : "Non signé"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/amendments/${amendment.id}/docx`}
                    className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
                  >
                    Générer en Word
                  </a>
                  {amendment.signedFileName && (
                    <a
                      href={`/api/amendments/${amendment.id}/signed`}
                      className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
                    >
                      Voir le signé ({amendment.signedFileName})
                    </a>
                  )}
                  <UploadSignedAmendment
                    amendmentId={amendment.id}
                    alreadyUploaded={Boolean(amendment.signedFileName)}
                  />
                  <DeleteAmendmentButton amendmentId={amendment.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
