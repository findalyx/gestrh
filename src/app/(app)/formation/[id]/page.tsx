import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EnrollmentStatus,
  TrainingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { canManageTraining } from "@/lib/training-access";
import { Icon } from "@/components/Icon";
import {
  EnrollmentStatusBadge,
  SessionStatusBadge,
} from "../_components/TrainingBadges";
import {
  EnrollButton,
  SetStatusButton,
  UnenrollButton,
} from "../_components/TrainingActions";
import { SessionForm } from "../_components/SessionForm";
import {
  CourseModuleForm,
  DeleteModuleButton,
} from "../_components/CourseModuleForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  const canManage = await canManageTraining();

  const course = await prisma.trainingCourse.findUnique({
    where: { id },
    include: {
      modules: { orderBy: { order: "asc" } },
      sessions: {
        orderBy: { startDate: "desc" },
        include: {
          _count: { select: { enrollments: true } },
          enrollments: {
            include: {
              agent: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  matricule: true,
                  service: { select: { name: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!course) notFound();

  // Mes propres inscriptions sur ce cours
  const myEnrollmentBySession = new Map<string, { id: string; status: EnrollmentStatus }>();
  if (me.agent) {
    for (const s of course.sessions) {
      const mine = s.enrollments.find((e) => e.agent.id === me.agent?.id);
      if (mine) myEnrollmentBySession.set(s.id, { id: mine.id, status: mine.status });
    }
  }

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/formation" className="hover:text-sc-blue">
          Formation
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">{course.title}</span>
      </div>

      {/* En-tête cours */}
      <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sc-blue">
              {course.category} ·{" "}
              {course.isInternal ? "Formation interne" : "Formation externe"}
              {course.durationHours && (
                <span> · {course.durationHours} h</span>
              )}
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-sc-blue-darker">
              {course.title}
            </h2>
            {course.instructor && (
              <p className="mt-1 text-[13px] text-gray-700">
                <span className="text-[11px] uppercase tracking-wider text-gray-500">
                  Formateur ·
                </span>{" "}
                {course.instructor}
              </p>
            )}
          </div>
          {canManage && (
            <Link
              href={`/formation/${course.id}/modifier`}
              className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
            >
              Modifier le cours
            </Link>
          )}
        </div>

        {course.description && (
          <div className="mt-4 border-t border-sc-border pt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
              {course.description}
            </p>
          </div>
        )}

        {course.objectives && (
          <div className="mt-3 border-t border-sc-border pt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
              Objectifs pédagogiques
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
              {course.objectives}
            </p>
          </div>
        )}
      </div>

      {/* Modules pédagogiques */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-purple" />
          Programme — modules ({course.modules.length})
        </h3>
        {course.modules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sc-border bg-white px-4 py-6 text-center text-[13px] text-gray-500">
            Aucun module défini.{" "}
            {canManage && "Ajoutez-en un avec le formulaire ci-dessous."}
          </p>
        ) : (
          <ol className="space-y-2">
            {course.modules.map((m, i) => (
              <li
                key={m.id}
                className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-gray-500">
                      Module {i + 1}
                      {m.durationHours && ` · ${m.durationHours} h`}
                    </p>
                    <h4 className="mt-0.5 font-medium text-sc-blue-darker">
                      {m.title}
                    </h4>
                    {m.description && (
                      <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-gray-700">
                        {m.description}
                      </p>
                    )}
                  </div>
                  {canManage && <DeleteModuleButton moduleId={m.id} />}
                </div>
              </li>
            ))}
          </ol>
        )}

        {canManage && (
          <details className="mt-3 rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-sc-blue-darker">
              + Ajouter un module
            </summary>
            <div className="border-t border-sc-border p-5">
              <CourseModuleForm courseId={course.id} />
            </div>
          </details>
        )}
      </section>

      {/* Formulaire création de session (DRH) */}
      {canManage && (
        <details className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-sc-blue-darker">
            + Programmer une nouvelle session
          </summary>
          <div className="border-t border-sc-border p-5">
            <SessionForm courseId={course.id} />
          </div>
        </details>
      )}

      {/* Sessions */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-teal" />
          Sessions ({course.sessions.length})
        </h3>

        {course.sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
            <Icon name="calendar" size={20} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">
              Aucune session programmée pour ce cours.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {course.sessions.map((s) => {
              const enrolled = myEnrollmentBySession.get(s.id);
              const full = s._count.enrollments >= s.capacity;
              const canEnroll =
                s.status === TrainingStatus.OUVERTE &&
                !full &&
                !enrolled &&
                Boolean(me.agent);
              const reason = !me.agent
                ? "Compte non lié à un agent"
                : enrolled
                  ? "Déjà inscrit"
                  : full
                    ? "Session complète"
                    : s.status !== TrainingStatus.OUVERTE
                      ? "Inscriptions non ouvertes"
                      : undefined;

              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
                >
                  {/* Header session */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sc-border px-5 py-4">
                    <div>
                      <p className="font-medium text-sc-blue-darker">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-gray-500">
                        {s.location ?? "Lieu non précisé"} ·{" "}
                        <span className="font-mono">
                          {s._count.enrollments}/{s.capacity}
                        </span>{" "}
                        places
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SessionStatusBadge value={s.status} />
                      {enrolled ? (
                        <EnrollmentStatusBadge value={enrolled.status} />
                      ) : (
                        <EnrollButton
                          sessionId={s.id}
                          disabled={!canEnroll}
                          reason={reason}
                        />
                      )}
                      {enrolled &&
                        (enrolled.status === EnrollmentStatus.INSCRIT ||
                          enrolled.status === EnrollmentStatus.CONFIRME) &&
                        s.status !== TrainingStatus.EN_COURS &&
                        s.status !== TrainingStatus.TERMINEE && (
                          <UnenrollButton enrollmentId={enrolled.id} />
                        )}
                    </div>
                  </div>

                  {/* Actions admin */}
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-sc-border bg-sc-blue-bg/40 px-5 py-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                        Statut :
                      </span>
                      {s.status === TrainingStatus.PLANIFIEE && (
                        <SetStatusButton
                          sessionId={s.id}
                          newStatus={TrainingStatus.OUVERTE}
                          label="Ouvrir aux inscriptions"
                          variant="primary"
                        />
                      )}
                      {s.status === TrainingStatus.OUVERTE && (
                        <>
                          <SetStatusButton
                            sessionId={s.id}
                            newStatus={TrainingStatus.EN_COURS}
                            label="Démarrer"
                            variant="primary"
                          />
                          <SetStatusButton
                            sessionId={s.id}
                            newStatus={TrainingStatus.PLANIFIEE}
                            label="Fermer les inscriptions"
                          />
                        </>
                      )}
                      {s.status === TrainingStatus.EN_COURS && (
                        <SetStatusButton
                          sessionId={s.id}
                          newStatus={TrainingStatus.TERMINEE}
                          label="Marquer terminée"
                          variant="primary"
                        />
                      )}
                      {(s.status === TrainingStatus.PLANIFIEE ||
                        s.status === TrainingStatus.OUVERTE) && (
                        <SetStatusButton
                          sessionId={s.id}
                          newStatus={TrainingStatus.ANNULEE}
                          label="Annuler"
                          variant="danger"
                        />
                      )}
                    </div>
                  )}

                  {/* Liste des inscrits (DRH + Manager voient, Agent ne voit que lui-même) */}
                  {(canManage || me.role === "MANAGER") && s.enrollments.length > 0 && (
                    <div className="px-5 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Inscrits ({s.enrollments.length})
                      </p>
                      <ul className="space-y-1">
                        {s.enrollments.map((e) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]"
                          >
                            <Link
                              href={`/personnel/${e.agent.id}`}
                              className="text-sc-blue-darker hover:underline"
                            >
                              {e.agent.lastName.toUpperCase()} {e.agent.firstName}
                              <span className="ml-1 text-[11px] text-gray-500">
                                · {e.agent.service.name}
                              </span>
                            </Link>
                            <div className="flex items-center gap-2">
                              <EnrollmentStatusBadge value={e.status} />
                              {e.score !== null && (
                                <span className="text-[11px] font-mono text-gray-600">
                                  {e.score}/100
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
