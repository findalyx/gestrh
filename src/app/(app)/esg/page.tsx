import Link from "next/link";
import { Role, EsgReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { NewReportForm } from "./_components/EsgActions";
import { currentQuarter } from "./_lib/periods";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export default async function EsgPage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  const [reports, org] = await Promise.all([
    prisma.esgReport.findMany({
      orderBy: { period: "desc" },
      include: { _count: { select: { answers: true } } },
    }),
    prisma.organization.findFirst({ select: { usdRate: true } }),
  ]);

  const now = new Date();
  const { year, q } = currentQuarter(now);
  const years = [year + 1, year, year - 1, year - 2];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Reporting ESG
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Questionnaire trimestriel investisseurs · les données RH sont
          pré-remplies automatiquement, le reste se saisit à la main.
        </p>
      </header>

      {org?.usdRate == null && (
        <div className="flex items-start gap-2 rounded-xl border border-sc-warning/40 bg-sc-warning-light px-4 py-3 text-[12.5px] text-[#854f0b]">
          <Icon name="alert" size={16} />
          <span>
            Le taux de conversion USD n&apos;est pas défini. Les montants en USD
            (salaires) ne seront pas calculés tant que vous ne l&apos;aurez pas
            renseigné dans{" "}
            <Link href="/parametres" className="font-semibold underline">
              Paramètres
            </Link>
            .
          </span>
        </div>
      )}

      <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <h3 className="mb-3 text-[13px] font-semibold text-sc-blue-darker">
          Nouveau rapport trimestriel
        </h3>
        <NewReportForm years={years} defaultYear={year} defaultQuarter={q} />
      </section>

      <section>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
          Rapports ({reports.length})
        </h3>
        {reports.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[12.5px] text-gray-500">
            Aucun rapport pour l&apos;instant. Créez le premier ci-dessus.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/esg/${r.id}`}
                className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:border-sc-blue hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-gray-400">
                    {r.period}
                  </span>
                  {r.status === EsgReportStatus.FINALISE ? (
                    <span className="rounded-full bg-sc-green-light px-2 py-[1px] text-[10px] font-semibold text-sc-green-dark">
                      Finalisé
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] font-semibold text-amber-700">
                      Brouillon
                    </span>
                  )}
                </div>
                <div className="mt-1 font-serif text-[15px] font-semibold text-sc-blue-darker">
                  {r.label}
                </div>
                <div className="mt-2 text-[11.5px] text-gray-500">
                  {r._count.answers} indicateurs renseignés · créé le{" "}
                  {formatDate(r.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
