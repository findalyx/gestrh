import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStage, JobStatus, Role, type Application } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { CategoryBadge } from "@/components/Badges";
import {
  ApplicationStageBadge,
  JobStatusBadge,
} from "../_components/RecruitmentBadges";
import {
  AdvanceButton,
  ClosePostingButton,
  InterviewDateForm,
  RejectButton,
  ReopenPostingButton,
} from "../_components/PipelineActions";
import { ApplicationForm } from "../_components/ApplicationForm";

export const dynamic = "force-dynamic";

const PIPELINE_VISIBLE: ApplicationStage[] = [
  ApplicationStage.CANDIDATURE,
  ApplicationStage.PRESELECTION,
  ApplicationStage.ENTRETIEN,
  ApplicationStage.FINALISTE,
  ApplicationStage.RECRUTE,
];

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function toDateTimeLocal(d: Date | null | undefined): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function JobPostingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const { id } = await params;

  const posting = await prisma.jobPosting.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      applications: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!posting) notFound();
  const postingId = posting.id;

  // Groupe les candidatures par étape
  const byStage = new Map<ApplicationStage, typeof posting.applications>();
  for (const stage of PIPELINE_VISIBLE) byStage.set(stage, []);
  const rejected: typeof posting.applications = [];
  for (const app of posting.applications) {
    if (app.stage === ApplicationStage.REJETE) {
      rejected.push(app);
    } else {
      byStage.get(app.stage)?.push(app);
    }
  }

  const total = posting.applications.length;
  const recruited = byStage.get(ApplicationStage.RECRUTE)?.length ?? 0;
  const canAddCandidates =
    posting.status === JobStatus.OUVERT || posting.status === JobStatus.EN_COURS;

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/recrutement" className="hover:text-sc-blue">
          Recrutement
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">{posting.title}</span>
      </div>

      {/* En-tête offre */}
      <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CategoryBadge value={posting.category} />
              <JobStatusBadge value={posting.status} />
            </div>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-sc-blue-darker">
              {posting.title}
            </h2>
            <p className="mt-1 text-[12.5px] text-gray-600">
              {posting.service?.name ?? "Service non précisé"} ·{" "}
              <span className="font-mono">{recruited}/{posting.openings}</span>{" "}
              poste{posting.openings > 1 ? "s" : ""} pourvu
              {recruited > 1 ? "s" : ""} · {total} candidat
              {total > 1 ? "s" : ""} total
            </p>
            <p className="mt-0.5 text-[11.5px] text-gray-500">
              Publiée le {formatDate(posting.publishedAt)}
              {posting.closesAt && ` · clôture : ${formatDate(posting.closesAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {posting.status === JobStatus.FERME ||
            posting.status === JobStatus.POURVU ? (
              <ReopenPostingButton postingId={posting.id} />
            ) : (
              <ClosePostingButton postingId={posting.id} />
            )}
          </div>
        </div>

        {posting.description && (
          <div className="mt-4 border-t border-sc-border pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
              {posting.description}
            </p>
          </div>
        )}
      </div>

      {/* Ajouter un candidat */}
      {canAddCandidates && (
        <details className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-sc-blue-darker">
            + Enregistrer un nouveau candidat
          </summary>
          <div className="border-t border-sc-border p-5">
            <ApplicationForm postingId={posting.id} />
          </div>
        </details>
      )}

      {/* Pipeline visuel */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-blue" />
          Pipeline ({total - rejected.length} en cours, {rejected.length} rejeté{rejected.length > 1 ? "s" : ""})
        </h3>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {PIPELINE_VISIBLE.map((stage) => {
            const apps = byStage.get(stage) ?? [];
            return (
              <div
                key={stage}
                className="rounded-xl border border-sc-border bg-sc-blue-bg/30 p-3"
              >
                <header className="mb-3 flex items-center justify-between">
                  <ApplicationStageBadge value={stage} />
                  <span className="text-[12px] font-bold text-sc-blue-darker">
                    {apps.length}
                  </span>
                </header>
                <div className="space-y-2">
                  {apps.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-sc-border bg-white px-2 py-3 text-center text-[11px] text-gray-400">
                      Aucun candidat
                    </p>
                  ) : (
                    apps.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        canAdvance={stage !== ApplicationStage.RECRUTE}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rejetés */}
      {rejected.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-danger" />
            Candidatures rejetées ({rejected.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <table className="w-full text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-3">Candidat</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Reçu le</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((app) => (
                  <tr key={app.id} className="border-t border-sc-border">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/recrutement/${postingId}/candidat/${app.id}`}
                        className="font-medium text-sc-blue-darker hover:underline"
                      >
                        {app.candidateName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-600 font-mono">
                      {app.candidateEmail}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {formatDate(app.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-600">
                      {app.notes ? (
                        <span className="line-clamp-2" title={app.notes}>
                          {app.notes}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );

  function ApplicationCard({
    app,
    canAdvance,
  }: {
    app: Application;
    canAdvance: boolean;
  }) {
    const nextLabel =
      app.stage === ApplicationStage.CANDIDATURE
        ? "Présélectionner →"
        : app.stage === ApplicationStage.PRESELECTION
          ? "Convoquer entretien →"
          : app.stage === ApplicationStage.ENTRETIEN
            ? "Finaliste →"
            : app.stage === ApplicationStage.FINALISTE
              ? "Recruter ✓"
              : null;

    return (
      <div className="rounded-lg border border-sc-border bg-white p-2.5">
        <Link
          href={`/recrutement/${postingId}/candidat/${app.id}`}
          className="block text-[12.5px] font-semibold leading-tight text-sc-blue-darker hover:underline"
        >
          {app.candidateName}
        </Link>
        <p className="mt-0.5 truncate text-[10.5px] font-mono text-gray-500">
          {app.candidateEmail}
        </p>
        {(app.cvFilename || app.cvUrl) && (
          <a
            href={
              app.cvFilename
                ? `/api/recrutement/cv/${app.id}`
                : (app.cvUrl as string)
            }
            target={app.cvFilename ? undefined : "_blank"}
            rel={app.cvFilename ? undefined : "noopener noreferrer"}
            className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-sc-blue hover:underline"
          >
            <Icon name="export" size={10} />
            {app.cvFilename ? "Télécharger CV" : "CV (lien)"}
          </a>
        )}

        {/* Entretien : affiche / modifie la date */}
        {app.stage === ApplicationStage.ENTRETIEN && (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              Entretien
            </p>
            {app.interviewAt && (
              <p className="text-[11px] text-sc-blue-darker">
                📅 {formatDateTime(app.interviewAt)}
              </p>
            )}
            <InterviewDateForm
              applicationId={app.id}
              currentDate={toDateTimeLocal(app.interviewAt)}
            />
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-sc-border pt-2">
          {canAdvance && nextLabel && (
            <AdvanceButton applicationId={app.id} label={nextLabel} />
          )}
          {app.stage !== ApplicationStage.RECRUTE && (
            <RejectButton applicationId={app.id} />
          )}
        </div>
      </div>
    );
  }
}

