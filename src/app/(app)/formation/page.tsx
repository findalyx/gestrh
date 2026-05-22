import Link from "next/link";
import {
  EnrollmentStatus,
  TrainingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  canManageTraining,
  getEnrollmentScopeWhere,
} from "@/lib/training-access";
import { Icon } from "@/components/Icon";
import { KpiCard } from "@/components/KpiCard";
import {
  EnrollmentStatusBadge,
  SessionStatusBadge,
} from "./_components/TrainingBadges";
import {
  EnrollButton,
  UnenrollButton,
} from "./_components/TrainingActions";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

type SearchParams = { categorie?: string };

export default async function FormationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const canManage = await canManageTraining();
  const { where: enrollmentWhere, scope } = await getEnrollmentScopeWhere();

  // Récupère les inscriptions actives de l'utilisateur (ou de son équipe)
  const myEnrollments = me.agent
    ? await prisma.trainingEnrollment.findMany({
        where: {
          agentId: me.agent.id,
          status: {
            in: [
              EnrollmentStatus.INSCRIT,
              EnrollmentStatus.CONFIRME,
              EnrollmentStatus.REALISE,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          session: {
            include: {
              course: { select: { id: true, title: true, category: true } },
            },
          },
        },
        take: 10,
      })
    : [];

  // Catalogue : filtre par catégorie si fourni
  const courseWhere = sp.categorie
    ? { category: sp.categorie }
    : {};

  const courses = await prisma.trainingCourse.findMany({
    where: courseWhere,
    orderBy: [{ category: "asc" }, { title: "asc" }],
    include: {
      sessions: {
        where: {
          status: { in: [TrainingStatus.OUVERTE, TrainingStatus.PLANIFIEE] },
          startDate: { gte: new Date() },
        },
        orderBy: { startDate: "asc" },
        include: {
          _count: { select: { enrollments: true } },
          enrollments: me.agent
            ? {
                where: { agentId: me.agent.id },
                select: { id: true, status: true },
              }
            : false,
        },
      },
    },
  });

  // Catégories distinctes pour le filtre
  const categories = await prisma.trainingCourse.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  // Statistiques pour DRH
  const stats = canManage
    ? await Promise.all([
        prisma.trainingCourse.count(),
        prisma.trainingSession.count({
          where: { status: TrainingStatus.OUVERTE },
        }),
        prisma.trainingEnrollment.count(),
      ])
    : [0, 0, 0];

  return (
    <div className="space-y-6">
      {/* Bandeau actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-[12.5px] text-gray-600">
          {scope === "ALL" && "Vue d'ensemble — catalogue de formations et inscriptions."}
          {scope === "TEAM" && "Catalogue de formations et inscriptions de votre équipe."}
          {scope === "SELF" && "Parcourez le catalogue et inscrivez-vous aux sessions ouvertes."}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Link
              href="/formation/nouveau"
              className="inline-flex items-center gap-2 rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
            >
              <span className="text-base leading-none">+</span> Nouveau cours
            </Link>
          </div>
        )}
      </div>

      {/* Stats DRH */}
      {canManage && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            color="blue"
            icon="training"
            label="Cours au catalogue"
            value={String(stats[0])}
            hint="Formations référencées"
          />
          <KpiCard
            color="green"
            icon="calendar"
            label="Sessions ouvertes"
            value={String(stats[1])}
            hint="Inscriptions possibles"
          />
          <KpiCard
            color="teal"
            icon="users"
            label="Inscriptions totales"
            value={String(stats[2])}
            hint="Toutes sessions"
          />
        </div>
      )}

      {/* Mes inscriptions */}
      {me.agent && myEnrollments.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-teal" />
            Mes inscriptions ({myEnrollments.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <table className="w-full text-[13px]">
              <thead className="bg-sc-blue-bg text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                  <th className="px-4 py-3">Formation</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Lieu</th>
                  <th className="px-4 py-3">Inscription</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myEnrollments.map((e) => {
                  const canUnenroll =
                    e.status === EnrollmentStatus.INSCRIT ||
                    e.status === EnrollmentStatus.CONFIRME;
                  const sessionOver =
                    e.session.status === TrainingStatus.EN_COURS ||
                    e.session.status === TrainingStatus.TERMINEE;
                  return (
                    <tr key={e.id} className="border-t border-sc-border">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/formation/${e.session.course.id}`}
                          className="font-medium text-sc-blue-darker hover:underline"
                        >
                          {e.session.course.title}
                        </Link>
                        <p className="text-[11px] text-gray-500">
                          {e.session.course.category}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {formatDate(e.session.startDate)} →{" "}
                        {formatDate(e.session.endDate)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {e.session.location ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <EnrollmentStatusBadge value={e.status} />
                        {e.score !== null && (
                          <span className="ml-1.5 text-[11px] text-gray-500">
                            note : {e.score}/100
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canUnenroll && !sessionOver && (
                          <UnenrollButton enrollmentId={e.id} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Filtre catégorie */}
      {categories.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="categorie"
              className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
            >
              Filtrer par catégorie
            </label>
            <select
              id="categorie"
              name="categorie"
              defaultValue={sp.categorie ?? ""}
              className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Filtrer
          </button>
          {sp.categorie && (
            <Link
              href="/formation"
              className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Réinitialiser
            </Link>
          )}
        </form>
      )}

      {/* Catalogue */}
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-blue" />
          Catalogue ({courses.length} cours)
        </h3>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
            <Icon name="training" size={20} className="mx-auto text-gray-300" />
            <p className="mt-2 text-[13px] text-gray-500">
              Aucun cours au catalogue pour le moment.
            </p>
            {canManage && (
              <Link
                href="/formation/nouveau"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-sc-blue hover:underline"
              >
                + Ajouter le premier cours
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {courses.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-sc-blue">
                      {c.category} · {c.isInternal ? "Interne" : "Externe"}
                    </p>
                    <Link
                      href={`/formation/${c.id}`}
                      className="mt-0.5 block font-serif text-[15px] font-semibold text-sc-blue-darker hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-[12px] text-gray-600">
                        {c.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sessions à venir */}
                <div className="mt-3 space-y-1.5">
                  {c.sessions.length === 0 ? (
                    <p className="text-[12px] text-gray-400">
                      Aucune session ouverte prochainement.
                    </p>
                  ) : (
                    c.sessions.slice(0, 3).map((s) => {
                      const enrolled = (s.enrollments?.[0]) ?? null;
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sc-border/60 bg-gray-50 px-3 py-2 text-[12px]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sc-blue-darker">
                              {formatDate(s.startDate)} →{" "}
                              {formatDate(s.endDate)}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {s.location ?? "—"} · {s._count.enrollments}/
                              {s.capacity} places
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
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
                          </div>
                        </div>
                      );
                    })
                  )}
                  {c.sessions.length > 3 && (
                    <Link
                      href={`/formation/${c.id}`}
                      className="text-[11.5px] font-medium text-sc-blue hover:underline"
                    >
                      Voir les {c.sessions.length} sessions →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

