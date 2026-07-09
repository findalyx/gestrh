import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplicationStage, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import {
  ApplicationStageBadge,
  STAGE_LABEL,
} from "../../../_components/RecruitmentBadges";
import {
  AdvanceButton,
  InterviewDateForm,
  RejectButton,
} from "../../../_components/PipelineActions";
import { CvUploadForm } from "../../../_components/CvUploadForm";
import {
  ApplicationNoteForm,
  DeleteNoteButton,
} from "../../../_components/ApplicationNoteForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

function toDateTimeLocal(d: Date | null | undefined): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function humanFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

const STAGE_ORDER: ApplicationStage[] = [
  ApplicationStage.CANDIDATURE,
  ApplicationStage.PRESELECTION,
  ApplicationStage.ENTRETIEN,
  ApplicationStage.FINALISTE,
  ApplicationStage.RECRUTE,
];

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const { id, appId } = await params;

  const application = await prisma.application.findUnique({
    where: { id: appId },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          category: true,
          service: { select: { name: true } },
        },
      },
      applicationNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { email: true } } },
      },
    },
  });

  if (!application) notFound();

  // Groupe les notes par étape
  const notesByStage = new Map<
    ApplicationStage,
    typeof application.applicationNotes
  >();
  for (const note of application.applicationNotes) {
    const arr = notesByStage.get(note.stage) ?? [];
    arr.push(note);
    notesByStage.set(note.stage, arr);
  }
  // Cohérence URL : l'application doit appartenir au posting de l'URL
  if (application.jobPostingId !== id) {
    redirect(`/recrutement/${application.jobPostingId}/candidat/${appId}`);
  }

  const currentStageIndex = STAGE_ORDER.indexOf(application.stage);
  const isRejected = application.stage === ApplicationStage.REJETE;
  const isHired = application.stage === ApplicationStage.RECRUTE;

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/recrutement" className="hover:text-sc-blue">
          Recrutement
        </Link>
        <span>/</span>
        <Link
          href={`/recrutement/${application.jobPosting.id}`}
          className="hover:text-sc-blue"
        >
          {application.jobPosting.title}
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">{application.candidateName}</span>
      </div>

      {/* En-tête candidature */}
      <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Candidat pour : {application.jobPosting.title}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-sc-blue-darker">
              {application.candidateName}
            </h2>
            <p className="mt-1 text-[12.5px] text-gray-600">
              Reçu le {formatDate(application.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ApplicationStageBadge value={application.stage} />
            <div className="flex flex-wrap items-center gap-1.5">
              {!isRejected && !isHired && (
                <AdvanceButton
                  applicationId={application.id}
                  label="Avancer →"
                />
              )}
              {!isRejected && !isHired && (
                <RejectButton applicationId={application.id} />
              )}
            </div>
          </div>
        </div>

        {/* Timeline du pipeline */}
        {!isRejected && (
          <div className="mt-5 border-t border-sc-border pt-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Progression
            </p>
            <ol className="flex flex-wrap items-center gap-1">
              {STAGE_ORDER.map((stage, i) => {
                const reached = i <= currentStageIndex;
                const current = i === currentStageIndex;
                return (
                  <li key={stage} className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        current
                          ? "bg-sc-blue text-white"
                          : reached
                            ? "bg-sc-green text-white"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {reached ? "✓" : i + 1}
                    </span>
                    <span
                      className={`text-[11.5px] ${
                        current
                          ? "font-semibold text-sc-blue-darker"
                          : reached
                            ? "text-sc-green-dark"
                            : "text-gray-400"
                      }`}
                    >
                      {STAGE_LABEL[stage]}
                    </span>
                    {i < STAGE_ORDER.length - 1 && (
                      <span
                        className={`mx-1 inline-block h-[2px] w-6 ${
                          i < currentStageIndex ? "bg-sc-green" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Coordonnées */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section icon="users" title="Coordonnées">
          <FieldRow label="Email">
            <a
              href={`mailto:${application.candidateEmail}`}
              className="font-mono text-sc-blue hover:underline"
            >
              {application.candidateEmail}
            </a>
          </FieldRow>
          <FieldRow label="Téléphone">
            {application.candidatePhone ? (
              <a
                href={`tel:${application.candidatePhone}`}
                className="font-mono text-sc-blue hover:underline"
              >
                {application.candidatePhone}
              </a>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </FieldRow>
        </Section>

        {/* CV */}
        <Section icon="export" title="CV">
          {application.cvFilename ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-sc-border bg-sc-blue-bg/40 px-3.5 py-2.5">
                <p className="text-[13px] font-medium text-sc-blue-darker">
                  {application.cvFilename}
                </p>
                <p className="text-[11px] text-gray-500">
                  {application.cvMimeType ?? "type inconnu"} ·{" "}
                  {humanFileSize(application.cvSize)}
                </p>
              </div>
              <a
                href={`/api/recrutement/cv/${application.id}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-sc-blue px-3 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
              >
                <Icon name="export" size={13} /> Télécharger le CV
              </a>
            </div>
          ) : application.cvUrl ? (
            <div className="space-y-2">
              <p className="text-[11.5px] text-gray-500">Lien externe :</p>
              <a
                href={application.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
              >
                <Icon name="export" size={13} /> Ouvrir le lien externe
              </a>
            </div>
          ) : (
            <p className="text-[12.5px] text-gray-500">
              Aucun CV joint à cette candidature.
            </p>
          )}
          <div className="mt-3 border-t border-sc-border pt-3">
            <p className="mb-1.5 text-[11.5px] font-medium text-sc-blue-darker">
              {application.cvFilename ? "Remplacer le CV" : "Ajouter un CV"}
            </p>
            <CvUploadForm applicationId={application.id} />
          </div>
        </Section>
      </div>

      {/* Entretien */}
      {(application.stage === ApplicationStage.ENTRETIEN ||
        application.stage === ApplicationStage.FINALISTE) && (
        <Section icon="calendar" title="Entretien">
          {application.interviewAt ? (
            <p className="text-[13px] text-sc-blue-darker">
              📅 Prévu le <strong>{formatDateTime(application.interviewAt)}</strong>
            </p>
          ) : (
            <p className="mb-2 text-[12.5px] text-gray-500">
              Aucune date d&apos;entretien planifiée.
            </p>
          )}
          <div className="mt-3">
            <InterviewDateForm
              applicationId={application.id}
              currentDate={toDateTimeLocal(application.interviewAt)}
            />
          </div>
        </Section>
      )}

      {/* Notes par étape */}
      <Section
        icon="info"
        title={`Notes & commentaires (${application.applicationNotes.length})`}
      >
        <p className="mb-3 text-[12px] text-gray-500">
          Chaque note est horodatée et associée à l&apos;étape du pipeline au
          moment de sa saisie.
        </p>

        {/* Saisie d'une nouvelle note — toujours à l'étape courante */}
        {!isRejected && (
          <div className="mb-4 rounded-lg border border-sc-border bg-sc-blue-bg/30 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
              Nouvelle note · étape actuelle :{" "}
              <ApplicationStageBadge value={application.stage} />
            </p>
            <ApplicationNoteForm applicationId={application.id} />
          </div>
        )}

        {/* Historique des notes groupées par étape */}
        {application.applicationNotes.length === 0 ? (
          <p className="text-[12.5px] text-gray-400">
            Aucune note saisie pour ce candidat.
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(notesByStage.entries()).map(([stage, notes]) => (
              <div key={stage}>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <ApplicationStageBadge value={stage} /> ({notes.length})
                </p>
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg border border-sc-border bg-white p-3 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-gray-500">
                          {formatDateTime(n.createdAt)} ·{" "}
                          <span className="font-mono">
                            {n.author?.email ?? "auteur supprimé"}
                          </span>
                        </p>
                        <DeleteNoteButton noteId={n.id} />
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                        {n.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Note libre historique (champ `notes` initial) */}
        {application.notes && (
          <div className="mt-4 rounded-lg border border-sc-border bg-gray-50 p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
              Note saisie à la création
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-gray-700">
              {application.notes}
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
          <Icon name={icon} size={14} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-sc-border/60 py-2 text-[13px] last:border-b-0">
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-gray-800">{children}</span>
    </div>
  );
}
