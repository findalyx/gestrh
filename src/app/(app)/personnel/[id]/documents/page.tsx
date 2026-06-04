import { notFound } from "next/navigation";
import { DocumentType } from "@prisma/client";
import { getAgentDetail } from "@/lib/personnel";
import { formatDate } from "@/lib/contract-utils";
import { Icon } from "@/components/Icon";
import { DocumentUploader } from "../../_components/DocumentUploader";
import { DocumentDeleteButton } from "../../_components/DocumentDeleteButton";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<DocumentType, string> = {
  CONTRAT: "Contrat",
  CONTRAT_SIGNE: "Contrat signé",
  AVENANT: "Avenant",
  AVENANT_SIGNE: "Avenant signé",
  DEMISSION: "Démission",
  NOTIFICATION_CONTRAT: "Notification contractuelle",
  DIPLOME: "Diplôme",
  CERTIFICATION: "Certification",
  BULLETIN_PAIE: "Bulletin de paie",
  JUSTIFICATIF: "Justificatif",
  CNI: "Carte d'identité",
  CASIER_JUDICIAIRE: "Casier judiciaire",
  RIB: "RIB",
  PHOTO: "Photo",
  CERTIFICAT_MEDICAL: "Certificat médical",
  CV: "CV",
  AUTRE: "Autre",
};

const TYPE_STYLE: Record<DocumentType, string> = {
  CONTRAT: "bg-sc-blue-light text-sc-blue",
  CONTRAT_SIGNE: "bg-sc-blue-light text-sc-blue",
  AVENANT: "bg-sc-purple-light text-sc-purple",
  AVENANT_SIGNE: "bg-sc-purple-light text-sc-purple",
  DEMISSION: "bg-sc-danger-light text-sc-danger",
  NOTIFICATION_CONTRAT: "bg-amber-100 text-amber-800",
  DIPLOME: "bg-sc-teal-light text-sc-teal-dark",
  CERTIFICATION: "bg-sc-teal-light text-sc-teal-dark",
  BULLETIN_PAIE: "bg-sc-green-light text-sc-green-dark",
  JUSTIFICATIF: "bg-gray-100 text-gray-700",
  CNI: "bg-sc-blue-light text-sc-blue",
  CASIER_JUDICIAIRE: "bg-amber-100 text-amber-800",
  RIB: "bg-sc-green-light text-sc-green-dark",
  PHOTO: "bg-gray-100 text-gray-700",
  CERTIFICAT_MEDICAL: "bg-sc-danger-light text-sc-danger",
  CV: "bg-sc-purple-light text-sc-purple",
  AUTRE: "bg-gray-100 text-gray-700",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export default async function AgentDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentDetail(id);
  if (!agent) notFound();

  const agentName = `${agent.lastName.toUpperCase()} ${agent.firstName}`;

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="documents" agentName={agentName} />
      <div className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sc-border px-5 py-3">
          <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
            {agent.documents.length} document
            {agent.documents.length > 1 ? "s" : ""} archivé
            {agent.documents.length > 1 ? "s" : ""}
          </h3>
          <DocumentUploader agentId={agent.id} />
        </div>
        {agent.documents.length === 0 ? (
          <div className="px-5 py-12 text-center text-[12px] text-gray-500">
            Aucun document archivé pour cet agent.
          </div>
        ) : (
          <ul className="divide-y divide-sc-border">
            {agent.documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
                    <Icon name="compliance" size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-sc-blue-darker">
                        {d.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLE[d.type]}`}
                      >
                        {TYPE_LABEL[d.type]}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {d.fileName} · {formatBytes(d.size)} · ajouté le{" "}
                      {formatDate(d.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/${d.id}`}
                    className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
                  >
                    Télécharger
                  </a>
                  <DocumentDeleteButton agentId={agent.id} documentId={d.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
