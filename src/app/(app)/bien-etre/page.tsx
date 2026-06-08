import Link from "next/link";
import { Role, WellbeingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  listUpcomingBirthdays,
  listCelebrableBirthdays,
  type BirthdayItem,
} from "@/lib/wellbeing";
import { Icon } from "@/components/Icon";
import { FeedbackForm } from "./_components/FeedbackForm";
import { FeedbackInbox, type InboxPost } from "./_components/FeedbackInbox";
import { BirthdayWish } from "./_components/BirthdayWish";

export const dynamic = "force-dynamic";

function dateLabel(item: BirthdayItem): string {
  const d = new Date(2000, item.month - 1, item.day);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
  }).format(d);
}

function whenLabel(d: number): string {
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `Dans ${d} jours`;
}

type Vue = "anniversaires" | "avis";

export default async function BienEtrePage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const sp = await searchParams;
  const vue: Vue = sp.vue === "avis" ? "avis" : "anniversaires";

  const me = await getCurrentUser();
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const firstName = me.agent?.firstName ?? "";

  const [celebrable, birthdays, posts, myWishes] = await Promise.all([
    listCelebrableBirthdays(new Date(), 3),
    listUpcomingBirthdays(new Date(), 30),
    isAdmin
      ? prisma.wellbeingPost.findMany({
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 200,
        })
      : Promise.resolve([]),
    // Messages d'anniversaire reçus par l'utilisateur (livrés en notifications).
    prisma.notification.findMany({
      where: { userId: me.id, title: { startsWith: "🎉" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, message: true, createdAt: true },
    }),
  ]);

  // « À venir » = strictement futur (aujourd'hui est géré par « à célébrer »).
  const upcoming = birthdays.filter((b) => !b.isToday);

  const inboxPosts: InboxPost[] = posts.map((p) => ({
    id: p.id,
    topic: p.topic,
    message: p.message,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));
  const newCount = inboxPosts.filter(
    (p) => p.status === WellbeingStatus.NOUVEAU,
  ).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-4 rounded-xl border border-sc-border bg-gradient-to-br from-sc-purple/10 to-sc-teal/10 p-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-sc-purple shadow-sm">
          <Icon name="heart" size={22} />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold text-sc-blue-darker">
            Bienvenue{firstName ? ` ${firstName}` : ""} 👋
          </h2>
          <p className="text-[12.5px] text-gray-600">
            dans votre espace de vie — célébrer les anniversaires et donner la
            parole à chacun, en toute confidentialité.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-sc-border bg-white p-1.5">
        <Link
          href="/bien-etre"
          className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition ${
            vue === "anniversaires"
              ? "bg-sc-purple text-white"
              : "text-sc-blue-darker hover:bg-sc-blue-light"
          }`}
        >
          🎂 Anniversaires
          {celebrable.length > 0 && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-[1px] text-[10.5px] font-bold ${
                vue === "anniversaires"
                  ? "bg-white/25 text-white"
                  : "bg-sc-purple-light text-sc-purple"
              }`}
            >
              {celebrable.length}
            </span>
          )}
        </Link>
        <Link
          href="/bien-etre?vue=avis"
          className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition ${
            vue === "avis"
              ? "bg-sc-teal text-white"
              : "text-sc-blue-darker hover:bg-sc-blue-light"
          }`}
        >
          💬 Avis &amp; idées
          {isAdmin && newCount > 0 && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-[1px] text-[10.5px] font-bold ${
                vue === "avis"
                  ? "bg-white/25 text-white"
                  : "bg-sc-warning-light text-[#854f0b]"
              }`}
            >
              {newCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mes messages d'anniversaire reçus */}
      {vue === "anniversaires" && myWishes.length > 0 && (
        <section className="rounded-xl border border-sc-purple/30 bg-gradient-to-br from-sc-purple/10 to-white p-5 shadow-[0_1px_2px_rgba(85,69,150,0.1)]">
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-purple">
            <Icon name="gift" size={18} />
            Vos messages d&apos;anniversaire 🎉
          </h3>
          <div className="space-y-2">
            {myWishes.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-sc-border bg-white px-4 py-3"
              >
                <p className="text-[13px] text-gray-700">{w.message}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "medium",
                  }).format(w.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== Onglet Anniversaires ===== */}
      {vue === "anniversaires" && celebrable.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <Icon name="gift" size={18} className="text-sc-purple" />
            À célébrer 🎉
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {celebrable.map((b) => (
              <div
                key={b.agentId}
                className={`rounded-xl border p-4 ${
                  b.isToday
                    ? "border-sc-purple/30 bg-gradient-to-br from-sc-purple/10 to-white shadow-[0_1px_2px_rgba(85,69,150,0.1)]"
                    : "border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-base font-semibold text-white">
                    🎂
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sc-blue-darker">
                      {b.fullName}
                    </p>
                    <p className="truncate text-[11.5px] text-gray-500">
                      {b.serviceName}
                      {b.age ? ` · ${b.age} ans` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11.5px] font-medium text-sc-purple">
                  {b.isToday
                    ? "C'est aujourd'hui !"
                    : `Anniversaire il y a ${b.daysSince} jour${b.daysSince > 1 ? "s" : ""}`}
                </p>
                <BirthdayWish
                  agentId={b.agentId}
                  firstName={b.firstName}
                  canSend={b.userId !== null}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Anniversaires à venir */}
      {vue === "anniversaires" && (
      <section>
        <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
          <span className="h-[18px] w-1 rounded bg-sc-purple" />
          Anniversaires à venir (30 jours)
        </h3>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sc-border bg-white p-6 text-center text-[13px] text-gray-500">
            Aucun anniversaire dans les 30 prochains jours.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <ul className="divide-y divide-sc-border">
              {upcoming.map((b) => (
                <li
                  key={b.agentId}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sc-purple-light text-sc-purple">
                    <Icon name="gift" size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-sc-blue-darker">
                      {b.fullName}
                    </p>
                    <p className="truncate text-[11.5px] text-gray-500">
                      {b.serviceName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-medium text-sc-blue-darker">
                      {dateLabel(b)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {whenLabel(b.daysUntil)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      )}

      {/* ===== Onglet Avis & idées ===== */}
      {vue === "avis" && <FeedbackForm />}

      {/* Avis reçus — DRH / Direction */}
      {vue === "avis" && isAdmin && (
        <section>
          <h3 className="mb-3 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
            <span className="h-[18px] w-1 rounded bg-sc-teal" />
            Avis reçus ({inboxPosts.length})
            {newCount > 0 && (
              <span className="rounded-full bg-sc-warning-light px-2 py-0.5 text-[11px] font-semibold text-[#854f0b]">
                {newCount} nouveau{newCount > 1 ? "x" : ""}
              </span>
            )}
          </h3>
          <p className="mb-3 text-[12px] text-gray-500">
            Avis déposés anonymement par les employés — aucune information ne
            permet d'identifier leur auteur.
          </p>
          <FeedbackInbox posts={inboxPosts} />
        </section>
      )}
    </div>
  );
}
