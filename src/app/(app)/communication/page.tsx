import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getAlertsForUser } from "@/lib/alerts";
import { Icon } from "@/components/Icon";
import { KpiCard } from "@/components/KpiCard";
import { AnnouncementForm } from "./_components/AnnouncementForm";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

export default async function CommunicationPage() {
  const me = await getCurrentUser();
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;

  const [announcements, alerts, totalAgents] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { publishedAt: "desc" },
      include: {
        author: { select: { email: true, role: true } },
        _count: { select: { attachments: true } },
      },
      take: 50,
    }),
    getAlertsForUser({
      id: me.id,
      role: me.role,
      agent: me.agent ? { id: me.agent.id } : null,
    }),
    prisma.agent.count(),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] text-gray-600">
        Annonces de la direction et notifications personnelles. Les annonces
        sont visibles par tout le personnel.
      </p>

      {/* Tuiles synthèse */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          color="blue"
          icon="communication"
          label="Annonces publiées"
          value={String(announcements.length)}
          hint="Disponibles pour tous"
        />
        <KpiCard
          color="purple"
          icon="bell"
          label="Alertes en cours"
          value={String(alerts.length)}
          hint={alerts.length > 0 ? "Actions à mener" : "Tout est à jour"}
        />
        <KpiCard
          color="teal"
          icon="users"
          label="Audience potentielle"
          value={String(totalAgents)}
          hint="Personnel inscrit"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Annonces */}
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <h3 className="flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
              <span className="h-[18px] w-1 rounded bg-sc-blue" />
              Annonces de la direction
            </h3>
          </header>

          {isAdmin && (
            <details className="rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-semibold text-sc-blue-darker">
                + Publier une annonce
              </summary>
              <div className="border-t border-sc-border p-5">
                <AnnouncementForm />
              </div>
            </details>
          )}

          {announcements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
              <Icon name="communication" size={20} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] text-gray-500">
                Aucune annonce publiée pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <Link
                  key={a.id}
                  href={`/communication/${a.id}`}
                  className="block rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:-translate-y-0.5 hover:border-sc-blue hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]"
                >
                  <header className="mb-2">
                    <h4 className="font-serif text-base font-semibold text-sc-blue-darker">
                      {a.title}
                    </h4>
                    <p className="text-[11.5px] text-gray-500">
                      {formatDateTime(a.publishedAt)} ·{" "}
                      <span className="font-mono">{a.author.email}</span>
                      <span className="ml-1 rounded-full bg-sc-blue-light px-1.5 py-[1px] text-[9.5px] font-semibold uppercase text-sc-blue">
                        {a.author.role}
                      </span>
                      {a._count.attachments > 0 && (
                        <span className="ml-2 text-[11px] text-sc-blue">
                          📎 {a._count.attachments} pièce
                          {a._count.attachments > 1 ? "s" : ""} jointe
                          {a._count.attachments > 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </header>
                  <p className="line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                    {a.body}
                  </p>
                  <p className="mt-2 text-[11.5px] font-medium text-sc-blue">
                    Lire la suite →
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Alertes en cours */}
        <aside>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-purple" />
            Alertes en cours
          </h3>
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center">
              <Icon name="bell" size={18} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[12.5px] text-gray-500">
                Aucune alerte. Tout est à jour ✓
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.link}
                    className="block rounded-xl border border-sc-border bg-white p-3 shadow-[0_1px_2px_rgba(51,89,164,0.06)] transition hover:-translate-y-0.5 hover:border-sc-blue hover:shadow-[0_4px_12px_rgba(51,89,164,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-sc-blue-darker">
                          {a.title}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-gray-600">
                          {a.message}
                        </p>
                      </div>
                      <span
                        className={`mt-0.5 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9.5px] font-semibold uppercase ${
                          a.type === "ALERTE"
                            ? "bg-sc-warning-light text-[#854f0b]"
                            : a.type === "RAPPEL"
                              ? "bg-sc-danger-light text-sc-danger"
                              : a.type === "VALIDATION"
                                ? "bg-sc-blue-light text-sc-blue"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {a.type}
                      </span>
                    </div>
                    <p className="mt-2 text-[10.5px] font-medium text-sc-blue">
                      Voir →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
