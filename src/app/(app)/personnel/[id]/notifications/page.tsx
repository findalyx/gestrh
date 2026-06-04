import { notFound } from "next/navigation";
import { ContractNotificationKind } from "@prisma/client";
import { getAgentDetail } from "@/lib/personnel";
import { formatDate } from "@/lib/contract-utils";
import {
  AcknowledgeButton,
  NewNotificationButton,
} from "../../_components/NotificationWidgets";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<ContractNotificationKind, string> = {
  RENOUVELLEMENT: "Renouvellement de contrat",
  NON_RENOUVELLEMENT: "Non-renouvellement de contrat",
  FIN_PERIODE_ESSAI: "Fin de période d'essai",
  RUPTURE_ANTICIPEE: "Rupture anticipée",
  CONFIRMATION_PERIODE_ESSAI: "Confirmation période d'essai",
};

const KIND_STYLE: Record<ContractNotificationKind, string> = {
  RENOUVELLEMENT: "bg-sc-green-light text-sc-green-dark",
  NON_RENOUVELLEMENT: "bg-sc-danger-light text-sc-danger",
  FIN_PERIODE_ESSAI: "bg-amber-100 text-amber-800",
  RUPTURE_ANTICIPEE: "bg-sc-danger-light text-sc-danger",
  CONFIRMATION_PERIODE_ESSAI: "bg-sc-blue-light text-sc-blue",
};

export default async function NotificationsTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentDetail(id);
  if (!agent) notFound();

  const agentName = `${agent.lastName.toUpperCase()} ${agent.firstName}`;
  const notifications = agent.contracts.flatMap((c) =>
    c.notifications.map((n) => ({ notif: n, contractRef: c.reference, contractId: c.id })),
  );
  const activeContract = agent.contracts.find((c) => c.status === "ACTIF");

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="notifications" agentName={agentName} />
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div>
            <h3 className="font-serif text-[14px] font-semibold text-sc-blue-darker">
              Notifications contractuelles
            </h3>
            <p className="text-[11px] text-gray-500">
              Courriers formels envoyés à l&apos;agent · {notifications.length} envoyé
              {notifications.length > 1 ? "s" : ""}
            </p>
          </div>
          {activeContract && <NewNotificationButton contractId={activeContract.id} />}
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12px] text-gray-500">
            Aucun courrier envoyé pour le moment. Utilisez le bouton « Nouvelle
            notification » pour émettre une lettre de confirmation de période
            d&apos;essai, de fin de période d&apos;essai ou de rupture anticipée. Les
            lettres de renouvellement / non-renouvellement de CDD sont émises depuis
            l&apos;onglet Renouvellement.
          </div>
        ) : (
          notifications.map(({ notif, contractRef }) => (
            <div
              key={notif.id}
              className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[notif.kind]}`}
                    >
                      {KIND_LABEL[notif.kind]}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Contrat {contractRef}
                    </span>
                  </div>
                  <h4 className="mt-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
                    {notif.subject}
                  </h4>
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  <div>Envoyé le {formatDate(notif.sentAt)}</div>
                  {notif.acknowledgedAt && (
                    <div>Accusé : {formatDate(notif.acknowledgedAt)}</div>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-gray-700">
                {notif.body}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={`/api/contract-notifications/${notif.id}`}
                  className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[11px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
                >
                  Télécharger la lettre (.docx)
                </a>
                {!notif.acknowledgedAt && (
                  <AcknowledgeButton notificationId={notif.id} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
