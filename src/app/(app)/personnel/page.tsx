import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  StaffCategory,
  AgentStatus,
  ContractStatus,
  ContractType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getAgentScopeWhere } from "@/lib/personnel-access";
import { listCddAlerts, listRetirementAlerts } from "@/lib/contract-alerts";
import {
  AgentStatusBadge,
  CategoryBadge,
  ContractTypeBadge,
} from "@/components/Badges";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
}

// Présents = encore en poste ; Partis = ont quitté l'organisation.
const PRESENT_STATUSES: AgentStatus[] = [
  AgentStatus.ACTIF,
  AgentStatus.SUSPENDU,
];
const GONE_STATUSES: AgentStatus[] = [
  AgentStatus.INACTIF,
  AgentStatus.RETRAITE,
];

type SearchParams = {
  q?: string;
  cat?: string;
  service?: string;
  statut?: string;
  vue?: string;
  contrat?: string;
  du?: string;
  au?: string;
  page?: string;
};

export default async function PersonnelListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();

  // Un agent simple va directement sur sa propre fiche
  if (me.role === Role.AGENT && me.agent) {
    redirect(`/personnel/${me.agent.id}`);
  }

  const { where: scopeWhere, scope } = await getAgentScopeWhere();

  const q = sp.q?.trim() ?? "";
  const cat =
    sp.cat === "PER" || sp.cat === "PATS" || sp.cat === "PRESTATAIRE"
      ? (sp.cat as StaffCategory)
      : undefined;
  const statut = isAgentStatus(sp.statut) ? sp.statut : undefined;
  const serviceId = sp.service?.trim() || undefined;
  const vue: "presents" | "partis" = sp.vue === "partis" ? "partis" : "presents";
  // Filtres avances (panneau « Plus de filtres »)
  const contrat = isContractType(sp.contrat) ? sp.contrat : undefined;
  const du = isIsoDate(sp.du) ? sp.du : undefined;
  const au = isIsoDate(sp.au) ? sp.au : undefined;
  const viewStatuses = vue === "partis" ? GONE_STATUSES : PRESENT_STATUSES;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const filters: Prisma.AgentWhereInput[] = [scopeWhere];
  if (q) {
    filters.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { matricule: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (cat) filters.push({ category: cat });
  // Vue « présents » (par défaut) ou « partis ». Un statut précis sélectionné
  // dans la vue courante affine encore (sinon on prend tous les statuts de la vue).
  filters.push({ status: { in: viewStatuses } });
  if (statut && viewStatuses.includes(statut)) filters.push({ status: statut });
  if (serviceId) filters.push({ serviceId });
  // Type de contrat : chez les presents on regarde le contrat EN COURS ; chez
  // les partis (plus aucun contrat actif) on accepte n'importe quel contrat.
  if (contrat) {
    filters.push({
      contracts: {
        some:
          vue === "partis"
            ? { type: contrat }
            : { type: contrat, status: ContractStatus.ACTIF },
      },
    });
  }
  // Plage de dates d'entree (date d'embauche).
  if (du || au) {
    filters.push({
      hireDate: {
        ...(du ? { gte: new Date(`${du}T00:00:00.000Z`) } : {}),
        ...(au ? { lte: new Date(`${au}T23:59:59.999Z`) } : {}),
      },
    });
  }

  const where: Prisma.AgentWhereInput = { AND: filters };

  const [agents, total, services] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: {
        service: { select: { name: true, code: true } },
        // Contrats recents : on retient le contrat actif s'il existe, sinon le
        // plus recent (utile pour les personnes parties).
        contracts: {
          orderBy: { startDate: "desc" },
          take: 5,
          select: { type: true, status: true, endDate: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.agent.count({ where }),
    scope === "SELF"
      ? Promise.resolve([])
      : prisma.service.findMany({
          where: scope === "SERVICE" ? { agents: { some: scopeWhere } } : undefined,
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const advancedCount = [contrat, du, au].filter(Boolean).length;
  const hasFilters = Boolean(q || cat || statut || serviceId) || advancedCount > 0;
  const canEdit = me.role === Role.DIRECTION || me.role === Role.DRH;

  // Construit une URL /personnel en préservant les filtres courants.
  const hrefWith = (over: Record<string, string | undefined>): string => {
    const params: Record<string, string | undefined> = {
      q: q || undefined,
      cat: cat || undefined,
      service: serviceId || undefined,
      statut: statut || undefined,
      vue: vue === "partis" ? "partis" : undefined,
      contrat: contrat || undefined,
      du: du || undefined,
      au: au || undefined,
      ...over,
    };
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
    const s = usp.toString();
    return s ? `/personnel?${s}` : "/personnel";
  };
  // Bascule présents ↔ partis (on repart sans statut précis).
  const toggleHref = hrefWith({
    vue: vue === "partis" ? undefined : "partis",
    statut: undefined,
    page: undefined,
  });

  // Signalements par agent : échéance CDD (expiré / imminent) ou départ
  // retraite proche. Le plus grave l'emporte.
  const agentFlags = new Map<string, { label: string; cls: string; title: string }>();
  if (scope !== "SELF") {
    const [cddAlerts, retirementAlerts] = await Promise.all([
      listCddAlerts(),
      listRetirementAlerts(),
    ]);
    for (const a of cddAlerts) {
      if (a.level === "expire") {
        agentFlags.set(a.agentId, {
          label: "CDD expiré",
          cls: "bg-sc-danger-light text-sc-danger",
          title: `Contrat ${a.reference} expiré`,
        });
      } else if (
        (a.level === "imminent" || a.level === "proche") &&
        !agentFlags.has(a.agentId)
      ) {
        agentFlags.set(a.agentId, {
          label: `CDD J−${a.daysRemaining}`,
          cls: "bg-orange-100 text-orange-700",
          title: `Contrat ${a.reference} · échéance dans ${a.daysRemaining} jours`,
        });
      }
    }
    for (const r of retirementAlerts) {
      if ((r.alertWindow ?? 99) <= 24 && !agentFlags.has(r.agentId)) {
        agentFlags.set(r.agentId, {
          label: "Retraite proche",
          cls: "bg-amber-50 text-amber-700",
          title: `Départ retraite à anticiper (${r.totalMonthsRemaining} mois)`,
        });
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={toggleHref}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
            vue === "partis"
              ? "border-sc-blue bg-sc-blue-light text-sc-blue"
              : "border-sc-border bg-white text-sc-blue-darker hover:bg-sc-blue-bg"
          }`}
        >
          {vue === "partis" ? (
            "← Personnes présentes"
          ) : (
            <>
              <Icon name="logout" size={14} /> Personnes parties
            </>
          )}
        </Link>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/personnel/echeances"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
            >
              <Icon name="alert" size={14} /> Échéances &amp; retraites
            </Link>
            <Link
              href="/personnel/statistiques"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
            >
              <Icon name="dashboard" size={14} /> Statistiques
            </Link>
            <Link
              href="/personnel/clauses"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
            >
              <Icon name="compliance" size={14} /> Clauses
            </Link>
            <Link
              href="/personnel/nouveau"
              className="inline-flex items-center gap-2 rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
            >
              <span className="text-base leading-none">+</span> Nouvelle fiche
            </Link>
          </div>
        )}
      </div>

      {/* Bandeau de filtres */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
      >
        {vue === "partis" && <input type="hidden" name="vue" value="partis" />}
        <div className="flex flex-1 flex-col gap-1 min-w-[220px]">
          <label
            htmlFor="q"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Recherche
          </label>
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nom, matricule, email…"
              className="w-full rounded-lg border border-sc-border bg-gray-50 py-[8px] pl-9 pr-3 text-[13px] outline-none transition focus:border-sc-blue focus:bg-white focus:ring-[3px] focus:ring-sc-blue/10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="cat"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Catégorie
          </label>
          <select
            id="cat"
            name="cat"
            defaultValue={cat ?? ""}
            className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          >
            <option value="">Toutes</option>
            <option value="PER">PER</option>
            <option value="PATS">PATS</option>
            <option value="PRESTATAIRE">Permanents</option>
          </select>
        </div>

        {services.length > 0 && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="service"
              className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
            >
              Service
            </label>
            <select
              id="service"
              name="service"
              defaultValue={serviceId ?? ""}
              className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
            >
              <option value="">Tous</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="statut"
            className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
          >
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            defaultValue={statut ?? ""}
            className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
          >
            <option value="">Tous</option>
            {vue === "partis" ? (
              <>
                <option value="RETRAITE">Retraité</option>
                <option value="INACTIF">Inactif</option>
              </>
            ) : (
              <>
                <option value="ACTIF">Actif</option>
                <option value="SUSPENDU">Suspendu</option>
              </>
            )}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-sc-blue px-4 py-[9px] text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
          >
            Filtrer
          </button>
          {hasFilters && (
            <Link
              href={vue === "partis" ? "/personnel?vue=partis" : "/personnel"}
              className="rounded-lg border border-sc-border bg-white px-4 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Réinitialiser
            </Link>
          )}
        </div>

        {/* Plus de filtres : type de contrat + plage de dates d'entrée.
            Ouvert d'office si l'un de ces filtres est déjà actif. */}
        <details className="group w-full" open={advancedCount > 0}>
          <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-[7px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50">
            Plus de filtres
            {advancedCount > 0 && (
              <span className="rounded-full bg-sc-blue px-1.5 py-[1px] text-[10px] font-semibold text-white">
                {advancedCount}
              </span>
            )}
            <Icon
              name="chevron-down"
              size={13}
              className="transition-transform group-open:rotate-180"
            />
          </summary>

          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-sc-border bg-gray-50/70 p-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="contrat"
                className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
              >
                Type de contrat
              </label>
              <select
                id="contrat"
                name="contrat"
                defaultValue={contrat ?? ""}
                className="rounded-lg border border-sc-border bg-white px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue"
              >
                <option value="">Tous</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="STAGE">Stage</option>
                <option value="VACATAIRE">Vacataire</option>
                <option value="PRESTATION">Prestation</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="du"
                className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
              >
                Entrée à partir du
              </label>
              <input
                type="date"
                id="du"
                name="du"
                defaultValue={du ?? ""}
                className="rounded-lg border border-sc-border bg-white px-3 py-[7px] text-[13px] outline-none focus:border-sc-blue"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="au"
                className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
              >
                Entrée jusqu&apos;au
              </label>
              <input
                type="date"
                id="au"
                name="au"
                defaultValue={au ?? ""}
                className="rounded-lg border border-sc-border bg-white px-3 py-[7px] text-[13px] outline-none focus:border-sc-blue"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-sc-blue px-4 py-[9px] text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
            >
              Appliquer
            </button>

            <p className="w-full text-[11px] text-gray-500">
              Le type de contrat porte sur le contrat{" "}
              {vue === "partis" ? "le plus récent" : "en cours"} ; les dates
              portent sur la date d&apos;entrée (embauche).
            </p>
          </div>
        </details>
      </form>

      {/* Compteur */}
      <div className="flex items-center justify-between text-[12.5px] text-gray-600">
        <p>
          <span className="font-semibold text-sc-blue-darker">{total}</span>{" "}
          {vue === "partis"
            ? `personne${total > 1 ? "s" : ""} partie${total > 1 ? "s" : ""}`
            : `agent${total > 1 ? "s" : ""} présent${total > 1 ? "s" : ""}`}
          {hasFilters ? " (filtrés)" : ""}
          {scope === "SERVICE" && " · votre service"}
          {scope === "SELF" && " · votre fiche"}
        </p>
        {totalPages > 1 && (
          <p className="text-gray-500">
            Page {page} / {totalPages}
          </p>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="bg-sc-blue-bg text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Poste</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Contrat</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-[13px] text-gray-500"
                >
                  {vue === "partis"
                    ? "Aucune personne partie."
                    : "Aucun agent présent trouvé."}
                </td>
              </tr>
            ) : (
              agents.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-sc-border transition hover:bg-sc-blue-bg/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-gray-600">
                    {a.matricule}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Avatar
                        size={32}
                        initials={`${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase()}
                        src={
                          a.photoUrl?.startsWith("agents/")
                            ? `/api/personnel/${a.id}/photo`
                            : null
                        }
                      />
                      <Link
                        href={`/personnel/${a.id}`}
                        className="font-medium text-sc-blue-darker hover:underline"
                      >
                        {a.lastName.toUpperCase()} {a.firstName}
                      </Link>
                      {agentFlags.get(a.id) && (
                        <span
                          title={agentFlags.get(a.id)!.title}
                          className={`whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9.5px] font-semibold ${agentFlags.get(a.id)!.cls}`}
                        >
                          ⚠ {agentFlags.get(a.id)!.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{a.service.name}</td>
                  <td className="px-4 py-2.5 text-gray-700">{a.jobTitle}</td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge value={a.category} />
                  </td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const active = a.contracts.find(
                        (c) => c.status === ContractStatus.ACTIF,
                      );
                      const c = active ?? a.contracts[0];
                      if (!c)
                        return (
                          <span className="text-[11.5px] text-gray-400">—</span>
                        );
                      return (
                        <div className="flex flex-col gap-0.5">
                          <ContractTypeBadge value={c.type} muted={!active} />
                          {c.endDate && (
                            <span className="text-[10.5px] text-gray-500">
                              {active ? "jusqu'au " : "fin "}
                              {formatShortDate(c.endDate)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                    <AgentStatusBadge value={a.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/personnel/${a.id}`}
                      className="text-sc-blue hover:text-sc-blue-dark"
                      aria-label="Voir la fiche"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => hrefWith({ page: String(p) })}
        />
      )}
    </div>
  );
}

function isContractType(v: string | undefined): v is ContractType {
  return (
    v === "CDI" ||
    v === "CDD" ||
    v === "VACATAIRE" ||
    v === "STAGE" ||
    v === "PRESTATION"
  );
}

function isIsoDate(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isAgentStatus(v: string | undefined): v is AgentStatus {
  return v === "ACTIF" || v === "SUSPENDU" || v === "RETRAITE" || v === "INACTIF";
}

function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const base =
    "rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12.5px] font-medium transition";
  const disabled = "cursor-not-allowed text-gray-400";
  const active = "text-sc-blue-darker hover:bg-sc-blue-bg";

  return (
    <nav className="flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={buildHref(prev)} className={`${base} ${active}`}>
          ← Précédent
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>← Précédent</span>
      )}
      <span className="text-[12.5px] text-gray-600">
        Page {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(next)} className={`${base} ${active}`}>
          Suivant →
        </Link>
      ) : (
        <span className={`${base} ${disabled}`}>Suivant →</span>
      )}
    </nav>
  );
}
