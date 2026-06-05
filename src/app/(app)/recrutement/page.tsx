import Link from "next/link";
import { ApplicationStage, JobStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { KpiCard } from "@/components/KpiCard";
import { CategoryBadge } from "@/components/Badges";
import { JobStatusBadge } from "./_components/RecruitmentBadges";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

type SearchParams = { statut?: string };

export default async function RecrutementListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const sp = await searchParams;

  // Le filtre "EN_COURS" est fusionné avec "OUVERT" : on cherche les deux.
  const statusFilter = parseStatusFilter(sp.statut);

  const [postings, activeCount, filledCount, closedCount, applicationsActive] =
    await Promise.all([
      prisma.jobPosting.findMany({
        where: statusFilter ? { status: { in: statusFilter } } : {},
        orderBy: { publishedAt: "desc" },
        include: {
          service: { select: { name: true } },
          _count: { select: { applications: true } },
        },
        take: 200,
      }),
      // "En cours" = OUVERT ou EN_COURS (héritage)
      prisma.jobPosting.count({
        where: { status: { in: [JobStatus.OUVERT, JobStatus.EN_COURS] } },
      }),
      prisma.jobPosting.count({ where: { status: JobStatus.POURVU } }),
      prisma.jobPosting.count({ where: { status: JobStatus.FERME } }),
      prisma.application.count({
        where: {
          stage: { notIn: [ApplicationStage.RECRUTE, ApplicationStage.REJETE] },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[12.5px] text-gray-600">
          Suivi des offres d&apos;emploi et du pipeline de candidatures.
        </p>
        <Link
          href="/recrutement/nouvelle"
          className="inline-flex items-center gap-2 rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
        >
          <span className="text-base leading-none">+</span> Nouvelle offre
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="green"
          icon="recruitment"
          label="Offres en cours"
          value={String(activeCount)}
          hint="Acceptent des candidats"
        />
        <KpiCard
          color="teal"
          icon="evaluation"
          label="Offres pourvues"
          value={String(filledCount)}
          hint="Postes remplis"
        />
        <KpiCard
          color="warning"
          icon="info"
          label="Offres fermées"
          value={String(closedCount)}
          hint="Clôturées manuellement"
        />
        <KpiCard
          color="purple"
          icon="users"
          label="Candidatures actives"
          value={String(applicationsActive)}
          hint="Hors recrutés / rejetés"
        />
      </div>

      {/* Filtre statut */}
      <form method="get" className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="statut"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Filtrer par statut
          </label>
          <select
            id="statut"
            name="statut"
            defaultValue={sp.statut ?? ""}
            className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          >
            <option value="">Tous</option>
            <option value="EN_COURS">En cours</option>
            <option value="POURVU">Pourvues</option>
            <option value="FERME">Fermées</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Filtrer
        </button>
        {statusFilter && (
          <Link
            href="/recrutement"
            className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {/* Liste des offres */}
      {postings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
          <Icon name="recruitment" size={20} className="mx-auto text-gray-300" />
          <p className="mt-2 text-[13px] text-gray-500">
            Aucune offre d&apos;emploi enregistrée.
          </p>
          <Link
            href="/recrutement/nouvelle"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-sc-blue hover:underline"
          >
            + Publier votre première offre
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-3">Intitulé</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3 text-right">Postes</th>
                <th className="px-4 py-3 text-right">Candidats</th>
                <th className="px-4 py-3">Publication</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {postings.map((p) => (
                <tr key={p.id} className="border-t border-sc-border">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/recrutement/${p.id}`}
                      className="font-medium text-sc-blue-darker hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.closesAt && (
                      <p className="text-[11px] text-gray-500">
                        Clôture : {formatDate(p.closesAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {p.service?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge value={p.category} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{p.openings}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {p._count.applications}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {formatDate(p.publishedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <JobStatusBadge value={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/recrutement/${p.id}`}
                      className="text-[12px] font-medium text-sc-blue hover:underline"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Convertit la valeur du filtre en liste de statuts Prisma à matcher.
 *   - "EN_COURS" couvre OUVERT + EN_COURS (héritage)
 *   - "POURVU" et "FERME" : valeurs uniques
 *   - autre / vide : pas de filtre
 */
function parseStatusFilter(v: string | undefined): JobStatus[] | undefined {
  if (v === "EN_COURS") return [JobStatus.OUVERT, JobStatus.EN_COURS];
  if (v === "POURVU") return [JobStatus.POURVU];
  if (v === "FERME") return [JobStatus.FERME];
  return undefined;
}

