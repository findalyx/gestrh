import Link from "next/link";
import { notFound } from "next/navigation";
import { Role, EsgReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { EsgReportEditor } from "../_components/EsgReportEditor";
import {
  RefreshAutoButton,
  StatusButton,
  DeleteReportButton,
} from "../_components/EsgActions";
import { ESG_METRICS } from "../_lib/registry";

export const dynamic = "force-dynamic";

export default async function EsgReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(Role.DIRECTION, Role.DRH);

  const report = await prisma.esgReport.findUnique({
    where: { id },
    include: { answers: true },
  });
  if (!report) notFound();

  const answers = Object.fromEntries(
    report.answers.map((a) => [
      a.metricKey,
      { value: a.value, comment: a.comment },
    ]),
  );

  // Signature stable des réponses → remonte l'éditeur quand les données
  // changent côté serveur (après « Rafraîchir » ou enregistrement).
  const sig = ESG_METRICS.map(
    (m) => `${answers[m.key]?.value ?? ""}~${answers[m.key]?.comment ?? ""}`,
  ).join("|");

  const autoCount = ESG_METRICS.filter((m) => m.auto).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/esg" className="hover:text-sc-blue">
          Reporting ESG
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">{report.label}</span>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
              {report.label}
            </h2>
            {report.status === EsgReportStatus.FINALISE ? (
              <span className="rounded-full bg-sc-green-light px-2 py-[1px] text-[10px] font-semibold text-sc-green-dark">
                Finalisé
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] font-semibold text-amber-700">
                Brouillon
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-gray-500">
            {autoCount} indicateurs RH pré-remplis automatiquement · le reste se
            saisit ci-dessous.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshAutoButton reportId={report.id} />
          <a
            href={`/api/esg/${report.id}/export`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sc-green px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sc-green-dark"
          >
            <Icon name="export" size={13} /> Exporter en Excel
          </a>
          <StatusButton reportId={report.id} status={report.status} />
          <DeleteReportButton reportId={report.id} />
        </div>
      </header>

      <EsgReportEditor key={sig} reportId={report.id} answers={answers} />
    </div>
  );
}
