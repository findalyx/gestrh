import Link from "next/link";
import { PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { getPayrollScopeWhere } from "@/lib/payroll-access";
import { Icon } from "@/components/Icon";
import { KpiCard } from "@/components/KpiCard";
import { PayrollStatusBadge } from "./_components/PayrollBadge";
import {
  GeneratePayrollForm,
  MarkPeriodPaidBatchButton,
  ValidatePeriodBatchButton,
} from "./_components/PayrollActions";
import { ImportPayslipsForm } from "./_components/ImportPayslipsForm";

// Manager n'a pas accès (cf. matrice) ; AGENT, DRH, DIRECTION oui.
export const dynamic = "force-dynamic";

const FCFA = new Intl.NumberFormat("fr-FR");

function formatPeriod(p: string): string {
  // "2026-05" → "Mai 2026"
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
}

type SearchParams = {
  year?: string;
  month?: string;
  period?: string; // ancien paramètre, géré pour compat (?period=YYYY-MM)
  generated?: string;
};

const MONTHS_LABEL: Record<string, string> = {
  "01": "Janvier",
  "02": "Février",
  "03": "Mars",
  "04": "Avril",
  "05": "Mai",
  "06": "Juin",
  "07": "Juillet",
  "08": "Août",
  "09": "Septembre",
  "10": "Octobre",
  "11": "Novembre",
  "12": "Décembre",
};

export default async function PaiePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH, Role.AGENT);
  const me = await getCurrentUser();
  const { where: scopeWhere, scope } = await getPayrollScopeWhere();
  const sp = await searchParams;

  // Liste des périodes existantes pour le filtre
  const periods = await prisma.payrollRecord.findMany({
    where: scopeWhere,
    select: { period: true },
    distinct: ["period"],
    orderBy: { period: "desc" },
  });

  // Compat ascendante : ancien paramètre ?period=YYYY-MM
  const legacyPeriod = sp.period?.trim();
  const legacyYear = legacyPeriod?.slice(0, 4);
  const legacyMonth = legacyPeriod?.slice(5, 7);

  // Années disponibles (du plus récent au plus ancien)
  const years = Array.from(
    new Set(periods.map((p) => p.period.slice(0, 4))),
  ).sort((a, b) => b.localeCompare(a));

  const selectedYear =
    (sp.year?.trim() || legacyYear || years[0] || String(new Date().getFullYear()));
  const rawMonth = (sp.month?.trim() ?? legacyMonth ?? "").trim();
  const selectedMonth = rawMonth === "all" ? "" : rawMonth;

  // Mois disponibles pour l'année sélectionnée
  const monthsForYear = periods
    .filter((p) => p.period.startsWith(`${selectedYear}-`))
    .map((p) => p.period.slice(5, 7))
    .sort();

  // Période effective pour les libellés et la génération
  const selectedPeriod = selectedMonth ? `${selectedYear}-${selectedMonth}` : null;

  // Filtre Prisma : soit une période précise, soit toute l'année
  const periodFilter: { period: string } | { period: { startsWith: string } } =
    selectedPeriod
      ? { period: selectedPeriod }
      : { period: { startsWith: `${selectedYear}-` } };

  const listWhere = { AND: [scopeWhere, periodFilter] };

  const [records, totalCount, draftCount, validatedCount] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: listWhere,
      orderBy: [{ period: "desc" }, { agent: { lastName: "asc" } }],
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
      take: 1000,
    }),
    prisma.payrollRecord.count({ where: scopeWhere }),
    selectedPeriod && scope === "ALL"
      ? prisma.payrollRecord.count({
          where: { period: selectedPeriod, status: PayrollStatus.BROUILLON },
        })
      : Promise.resolve(0),
    selectedPeriod && scope === "ALL"
      ? prisma.payrollRecord.count({
          where: { period: selectedPeriod, status: PayrollStatus.VALIDE },
        })
      : Promise.resolve(0),
  ]);

  // Totaux affichés pour DRH
  const totals = records.reduce(
    (acc, r) => ({
      gross: acc.gross + r.baseSalary + r.bonuses + r.allowances,
      net: acc.net + r.netSalary,
      contributions: acc.contributions + r.deductions,
    }),
    { gross: 0, net: 0, contributions: 0 },
  );

  // Période par défaut pour la génération : mois courant
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const isAdmin = scope === "ALL";

  const generatedCount = sp.generated ? Number(sp.generated) : 0;

  // Libellé de la période active (mois précis ou année complète)
  const activeLabel = selectedPeriod
    ? formatPeriod(selectedPeriod)
    : `Année ${selectedYear}`;

  // URL d'export prenant en compte le nouveau filtre
  const exportHref = selectedPeriod
    ? `/api/paie/export?period=${encodeURIComponent(selectedPeriod)}`
    : `/api/paie/export?year=${encodeURIComponent(selectedYear)}`;

  return (
    <div className="space-y-6">
      {/* Bandeau de confirmation après génération */}
      {generatedCount > 0 && selectedPeriod && (
        <div className="rounded-xl border border-sc-green/30 bg-sc-green-light px-4 py-3 text-[13px] text-sc-green-dark">
          ✓ {generatedCount} bulletin(s) généré(s) pour {formatPeriod(selectedPeriod)} —
          statut <strong>Brouillon</strong>. Vérifiez puis cliquez sur «&nbsp;Valider les
          {" "}{generatedCount} brouillons de la période&nbsp;» ci-dessous.
        </div>
      )}

      {/* Filtres année / mois + génération (admin) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {years.length > 0 && (
            <form method="get" className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="year"
                  className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Année
                </label>
                <select
                  id="year"
                  name="year"
                  defaultValue={selectedYear}
                  className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="month"
                  className="text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  Mois
                </label>
                <select
                  id="month"
                  name="month"
                  defaultValue={selectedMonth || "all"}
                  className="rounded-lg border border-sc-border bg-gray-50 px-3 py-[8px] text-[13px] outline-none focus:border-sc-blue focus:bg-white"
                >
                  <option value="all">Tous les mois</option>
                  {Object.entries(MONTHS_LABEL).map(([num, label]) => {
                    const has = monthsForYear.includes(num);
                    return (
                      <option key={num} value={num} disabled={!has}>
                        {label}
                        {!has ? " (aucun bulletin)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Filtrer
              </button>
            </form>
          )}

          {/* Bouton Export CSV — visible pour tous, exporte selon le rôle */}
          {records.length > 0 && (
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-[9px] text-[12.5px] font-medium text-gray-700 transition hover:bg-gray-50"
              title="Télécharger un fichier CSV (ouvrable dans Excel)"
            >
              <Icon name="export" size={13} />
              Exporter en CSV
            </a>
          )}
        </div>
      </div>

      {/* Outils admin : import PDF & génération — cartes compactes dépliables */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <details className="group rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sc-teal/10 text-sc-teal">
                <Icon name="import" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sc-blue-darker">
                  Importer des bulletins (PDF)
                </p>
                <p className="truncate text-[11.5px] text-gray-500">
                  Lecture automatique du PDF mensuel
                </p>
              </div>
              <Icon
                name="chevron-down"
                size={16}
                className="flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-sc-border p-4">
              <ImportPayslipsForm />
            </div>
          </details>

          <details className="group rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sc-blue-light text-sc-blue">
                <Icon name="payroll" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sc-blue-darker">
                  Générer une période
                </p>
                <p className="truncate text-[11.5px] text-gray-500">
                  Créer les bulletins automatiquement
                </p>
              </div>
              <Icon
                name="chevron-down"
                size={16}
                className="flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-sc-border p-4">
              <GeneratePayrollForm defaultPeriod={defaultPeriod} />
            </div>
          </details>
        </div>
      )}

      {/* Tuiles synthèse — visibles pour tous (admin = équipe / agent = perso) */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            color="blue"
            icon="payroll"
            label={isAdmin ? "Bulletins" : "Mes bulletins"}
            value={String(records.length)}
            hint={activeLabel}
          />
          <KpiCard
            color="purple"
            icon="users"
            label={isAdmin ? "Total brut" : "Mon brut cumulé"}
            value={FCFA.format(totals.gross)}
            hint="FCFA"
          />
          <KpiCard
            color="warning"
            icon="compliance"
            label="Cotisations salariales"
            value={FCFA.format(totals.contributions)}
            hint="IPRES 5,6 % + IPM 3 %"
          />
          <KpiCard
            color="green"
            icon="payroll"
            label={isAdmin ? "Total net à payer" : "Mon net cumulé"}
            value={FCFA.format(totals.net)}
            hint="FCFA"
          />
        </div>
      )}

      {/* Bandeau validation batch */}
      {isAdmin && selectedPeriod && draftCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sc-warning/30 bg-sc-warning-light px-4 py-3">
          <p className="text-[12.5px] text-[#854f0b]">
            <strong>{draftCount}</strong> bulletin(s) en brouillon pour{" "}
            {formatPeriod(selectedPeriod)}.
          </p>
          <ValidatePeriodBatchButton period={selectedPeriod} count={draftCount} />
        </div>
      )}

      {/* Bandeau "marquer payé" batch */}
      {isAdmin && selectedPeriod && validatedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sc-green/30 bg-sc-green-light px-4 py-3">
          <p className="text-[12.5px] text-sc-green-dark">
            <strong>{validatedCount}</strong> bulletin(s) validé(s) prêts à être
            marqués payés pour {formatPeriod(selectedPeriod)}.
          </p>
          <MarkPeriodPaidBatchButton period={selectedPeriod} count={validatedCount} />
        </div>
      )}

      {/* Liste */}
      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
          <Icon name="payroll" size={20} className="mx-auto text-gray-300" />
          <p className="mt-2 text-[13px] text-gray-500">
            {totalCount === 0
              ? scope === "SELF"
                ? "Vous n'avez aucun bulletin enregistré."
                : "Aucun bulletin n'a encore été généré."
              : "Aucun bulletin pour cette période."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sc-blue-bg text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-sc-blue-darker">
                <th className="px-4 py-3">Période</th>
                {isAdmin && <th className="px-4 py-3">Agent</th>}
                <th className="px-4 py-3 text-right">Brut (FCFA)</th>
                <th className="px-4 py-3 text-right">Cotisations</th>
                <th className="px-4 py-3 text-right">Net (FCFA)</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const gross = r.baseSalary + r.bonuses + r.allowances;
                return (
                  <tr key={r.id} className="border-t border-sc-border">
                    <td className="px-4 py-2.5 text-gray-700">
                      {formatPeriod(r.period)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/personnel/${r.agent.id}`}
                          className="font-medium text-sc-blue-darker hover:underline"
                        >
                          {r.agent.lastName.toUpperCase()} {r.agent.firstName}
                        </Link>
                        <p className="text-[11px] text-gray-500">
                          {r.agent.service.name} · {r.agent.matricule}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                      {FCFA.format(gross)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">
                      −{FCFA.format(r.deductions)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-sc-blue-darker">
                      {FCFA.format(r.netSalary)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PayrollStatusBadge value={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {r.pdfUrl && (
                          <a
                            href={`/api/paie/${r.id}/bulletin`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] font-medium text-sc-blue hover:underline"
                          >
                            📄 Bulletin
                          </a>
                        )}
                        <Link
                          href={`/paie/${r.id}`}
                          className="text-[12px] font-medium text-sc-blue hover:underline"
                        >
                          Voir →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Garde-fou de cohérence : indique si l'AGENT n'a aucun bulletin */}
      {scope === "SELF" && totalCount === 0 && me.agent && (
        <p className="text-center text-[12px] text-gray-500">
          Vos bulletins apparaîtront ici dès qu&apos;ils auront été générés par
          la DRH.
        </p>
      )}
    </div>
  );
}

