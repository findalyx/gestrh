import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { StaffCategory, AgentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { getAgentScopeWhere } from "@/lib/personnel-access";
import { AgentStatusBadge, CategoryBadge } from "@/components/Badges";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = {
  q?: string;
  cat?: string;
  service?: string;
  statut?: string;
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
  const cat = sp.cat === "PER" || sp.cat === "PATS" ? (sp.cat as StaffCategory) : undefined;
  const statut = isAgentStatus(sp.statut) ? sp.statut : undefined;
  const serviceId = sp.service?.trim() || undefined;
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
  if (statut) filters.push({ status: statut });
  if (serviceId) filters.push({ serviceId });

  const where: Prisma.AgentWhereInput = { AND: filters };

  const [agents, total, services] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: { service: { select: { name: true, code: true } } },
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
  const hasFilters = Boolean(q || cat || statut || serviceId);
  const canEdit = me.role === Role.DIRECTION || me.role === Role.DRH;

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      {canEdit && (
        <div className="flex justify-end">
          <Link
            href="/personnel/nouveau"
            className="inline-flex items-center gap-2 rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
          >
            <span className="text-base leading-none">+</span> Nouvelle fiche
          </Link>
        </div>
      )}

      {/* Bandeau de filtres */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-sc-border bg-white p-4 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
      >
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
            <option value="ACTIF">Actif</option>
            <option value="SUSPENDU">Suspendu</option>
            <option value="RETRAITE">Retraité</option>
            <option value="INACTIF">Inactif</option>
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
              href="/personnel"
              className="rounded-lg border border-sc-border bg-white px-4 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      {/* Compteur */}
      <div className="flex items-center justify-between text-[12.5px] text-gray-600">
        <p>
          <span className="font-semibold text-sc-blue-darker">{total}</span>{" "}
          agent{total > 1 ? "s" : ""}
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
      <div className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <table className="w-full text-[13px]">
          <thead className="bg-sc-blue-bg text-left">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Poste</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[13px] text-gray-500"
                >
                  Aucun agent trouvé.
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
                    <Link
                      href={`/personnel/${a.id}`}
                      className="font-medium text-sc-blue-darker hover:underline"
                    >
                      {a.lastName.toUpperCase()} {a.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{a.service.name}</td>
                  <td className="px-4 py-2.5 text-gray-700">{a.jobTitle}</td>
                  <td className="px-4 py-2.5">
                    <CategoryBadge value={a.category} />
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
          buildHref={(p) =>
            `/personnel?${new URLSearchParams({
              ...(q && { q }),
              ...(cat && { cat }),
              ...(statut && { statut }),
              ...(serviceId && { service: serviceId }),
              page: String(p),
            }).toString()}`
          }
        />
      )}
    </div>
  );
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
