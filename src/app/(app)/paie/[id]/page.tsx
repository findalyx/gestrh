import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { canViewPayroll } from "@/lib/payroll-access";
import { computeFullPayroll, isCadre } from "@/lib/payroll-calc";
import { getOrganization } from "@/lib/organization";
import { PayrollStatusBadge } from "../_components/PayrollBadge";
import {
  MarkPaidButton,
  ValidateButton,
} from "../_components/PayrollActions";
import { PrintButton } from "../_components/PrintButton";

export const dynamic = "force-dynamic";

const FCFA = new Intl.NumberFormat("fr-FR");
const NUM_2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return FCFA.format(n);
}

function fmtBase(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return NUM_2.format(n);
}

function fmtTaux(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return NUM_2.format(n);
}

function fmtPeriod(p: string): { month: string; year: string } {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return { month: p, year: "" };
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(
    new Date(y, m - 1, 1),
  );
  return { month: month.charAt(0).toUpperCase() + month.slice(1), year: String(y) };
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
}

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH, Role.AGENT);
  const { id } = await params;
  const me = await getCurrentUser();

  const record = await prisma.payrollRecord.findUnique({
    where: { id },
    include: {
      agent: {
        include: {
          service: { select: { name: true, code: true } },
          contracts: {
            where: { status: "ACTIF" },
            orderBy: { startDate: "desc" },
            take: 1,
            select: {
              type: true,
              grade: true,
              startDate: true,
              reference: true,
              baseSalary: true,
            },
          },
        },
      },
    },
  });

  if (!record) notFound();

  const allowed = await canViewPayroll(record.agentId);
  if (!allowed) redirect("/paie");

  const organization = await getOrganization();
  const logoUrl = organization.logoFilename
    ? `/api/branding/logo?v=${encodeURIComponent(organization.updatedAt.toISOString())}`
    : null;

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const contract = record.agent.contracts[0];
  const cadre = isCadre({
    category: record.agent.category,
    baseSalary: record.baseSalary,
  });

  // Calcul détaillé selon barèmes sénégalais
  const calc = computeFullPayroll({
    baseSalary: record.baseSalary,
    sursalaire: record.bonuses, // on assimile les "bonuses" stockés à du sursalaire
    isCadre: cadre,
    nbreJoursTravailles: 30,
    withTransport: true,
  });

  // Cumuls annuels (somme sur toutes les périodes de la même année pour cet agent)
  const yearOfPeriod = record.period.split("-")[0];
  const yearPayrolls = await prisma.payrollRecord.findMany({
    where: {
      agentId: record.agentId,
      period: { startsWith: yearOfPeriod },
    },
    select: {
      baseSalary: true,
      bonuses: true,
      deductions: true,
      netSalary: true,
    },
  });
  const cumulBrut = yearPayrolls.reduce(
    (s, p) => s + p.baseSalary + p.bonuses,
    0,
  );
  const cumulCotis = yearPayrolls.reduce((s, p) => s + p.deductions, 0);

  const period = fmtPeriod(record.period);
  const civilite = record.agent.gender === "HOMME" ? "M." : "Mme";

  return (
    <div className="space-y-4">
      {/* Barre de navigation hors impression */}
      <div className="no-print flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
          <Link href="/paie" className="hover:text-sc-blue">
            Paie
          </Link>
          <span>/</span>
          <span className="text-sc-blue-darker">
            {record.agent.firstName} {record.agent.lastName} · {period.month} {period.year}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PayrollStatusBadge value={record.status} />
          {isAdmin && record.status === PayrollStatus.BROUILLON && (
            <ValidateButton payrollId={record.id} />
          )}
          {isAdmin && record.status === PayrollStatus.VALIDE && (
            <MarkPaidButton payrollId={record.id} />
          )}
          <PrintButton />
        </div>
      </div>

      {/* Bulletin papier — format sénégalais */}
      <article className="payslip mx-auto max-w-[860px] rounded-lg border border-sc-border bg-white p-6 shadow-[0_1px_2px_rgba(51,89,164,0.06)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Bandeau supérieur : employeur + période */}
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-300 pb-3">
          <div className="flex items-start gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={organization.name}
                className="h-14 w-14 object-contain"
              />
            )}
            <div>
              <p className="font-serif text-[15px] font-semibold uppercase text-sc-blue-darker">
                {organization.name}
              </p>
              {(organization.address || organization.city) && (
                <p className="text-[11px] text-gray-600">
                  {[organization.address, organization.city, organization.country]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
              <p className="text-[10.5px] text-gray-500">
                {organization.ninea ? `N° NINEA : ${organization.ninea}` : "N° NINEA : —"}
                {organization.rccm ? ` · RCCM : ${organization.rccm}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wider text-gray-500">
              Période
            </p>
            <p className="font-serif text-[15px] font-semibold text-sc-blue-darker">
              {period.month} {period.year}
            </p>
          </div>
        </header>

        {/* Bandeau identité — ligne 1 */}
        <div className="mb-1 grid grid-cols-[90px_50px_1fr_1.4fr_90px] gap-x-4 border-b border-gray-200 pb-2 text-[10.5px]">
          <FieldCell label="N° SALARIÉ" value={record.agent.matricule} />
          <FieldCell label="QUAL." value={civilite} />
          <FieldCell
            label="PRÉNOM ET NOM"
            value={`${record.agent.firstName} ${record.agent.lastName.toUpperCase()}`}
          />
          <FieldCell
            label="ADRESSE"
            value={record.agent.address ?? "—"}
          />
          <FieldCell
            label="EMBAUCHE"
            value={formatDate(record.agent.hireDate)}
          />
        </div>

        {/* Bandeau identité — ligne 2 */}
        <div className="mb-1 grid grid-cols-[90px_90px_1fr_140px] gap-x-4 border-b border-gray-200 pb-2 pt-2 text-[10.5px]">
          <FieldCell label="CONV." value="UST" />
          <FieldCell label="CAT. PROF." value={contract?.grade ?? "—"} />
          <FieldCell label="EMPLOI" value={record.agent.jobTitle} center bold />
          <FieldCell label="MODE DE PAIEMENT" value="Virement" />
        </div>

        {/* Bandeau identité — ligne 3 (codes) */}
        <div className="mb-4 grid grid-cols-9 gap-x-2 border-b border-gray-200 pb-2 pt-2 text-[10px]">
          <FieldCell
            label="DIRECTION"
            value={record.agent.service.code}
            small
          />
          <FieldCell
            label="SERVICE"
            value={record.agent.service.code}
            small
          />
          <FieldCell label="RÉGIME" value={cadre ? "C" : "NC"} small />
          <FieldCell label="S.F." value="C" small />
          <FieldCell label="N.C." value="1" small />
          <FieldCell label="N.E." value="0" small />
          <FieldCell label="TRIMF" value="1" small />
          <FieldCell label="IMPÔTS" value="1" small />
          <FieldCell label="NBRE J." value="30" small />
        </div>

        {/* Tableau des rubriques */}
        <table className="payslip-table w-full border-collapse text-[10.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-left">
                Code
              </th>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-left">
                Libellé
              </th>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Nbre
              </th>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Base
              </th>
              <th
                colSpan={2}
                className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-center"
              >
                Charges salariales
              </th>
              <th
                colSpan={2}
                className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-center"
              >
                Charges patronales
              </th>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Taux
              </th>
              <th className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Retenue
              </th>
              <th className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Taux
              </th>
              <th className="border border-gray-300 bg-gray-50 px-1.5 py-1 text-right">
                Retenue
              </th>
            </tr>
          </thead>
          <tbody>
            {calc.lines.map((line, i) => (
              <tr
                key={i}
                className={
                  line.separator
                    ? "bg-gray-50 font-semibold"
                    : line.bold
                      ? "font-semibold"
                      : ""
                }
              >
                <td className="border border-gray-300 px-1.5 py-1 font-mono text-[10px] text-gray-700">
                  {line.code}
                </td>
                <td className="border border-gray-300 px-1.5 py-1">
                  {line.gainSal && !line.retenueSal ? (
                    <>
                      {line.label}
                      <span className="ml-1 text-[9px] uppercase text-sc-green-dark">
                        (non imposable)
                      </span>
                    </>
                  ) : (
                    line.label
                  )}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.nbre !== undefined ? NUM_2.format(line.nbre) : ""}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.base !== undefined ? fmtBase(line.base) : ""}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.tauxSal !== undefined ? fmtTaux(line.tauxSal) : ""}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.gainSal !== undefined
                    ? fmt(line.gainSal)
                    : line.retenueSal !== undefined
                      ? fmt(line.retenueSal)
                      : ""}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.tauxPat !== undefined ? fmtTaux(line.tauxPat) : ""}
                </td>
                <td className="border border-gray-300 px-1.5 py-1 text-right font-mono">
                  {line.retenuePat !== undefined ? fmt(line.retenuePat) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pied de bulletin — totaux et cumuls */}
        <div className="mt-4 border-t-2 border-gray-700">
          <div className="grid grid-cols-[90px_repeat(5,1fr)_140px] gap-x-3 py-2 text-[10.5px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
              Totaux du mois
            </div>
            <FieldCell label="Brut social" value={fmt(calc.brutSocial)} small mono />
            <FieldCell label="Avantage en nat." value={fmt(calc.avantageEnNature)} small mono />
            <FieldCell label="Brut fiscal" value={fmt(calc.brutFiscal)} small mono />
            <FieldCell label="Droits congé" value={fmt(calc.droitsConges)} small mono />
            <FieldCell label="Total cot. patr." value={fmt(calc.totalCotisPat)} small mono />
            <div className="rounded bg-sc-blue-darker px-2 py-1 text-right">
              <div className="text-[9px] uppercase tracking-wider text-white/70">
                Net à payer
              </div>
              <div className="font-serif text-[14px] font-bold text-white">
                {fmt(calc.netAPayer)}
              </div>
              <div className="text-[9px] text-white/70">FCFA</div>
            </div>
          </div>

          <div className="grid grid-cols-[90px_repeat(5,1fr)_140px] gap-x-3 border-t border-gray-300 py-2 text-[10.5px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
              Cumulés
            </div>
            <FieldCell label="Brut social" value={fmt(cumulBrut)} small mono />
            <FieldCell label="Avantage en nat." value="0" small mono />
            <FieldCell label="Brut fiscal" value={fmt(cumulBrut)} small mono />
            <FieldCell label="Cotisations" value={fmt(cumulCotis)} small mono />
            <div />
            <div />
          </div>
        </div>

        {/* Mention de fin */}
        <footer className="mt-4 border-t border-gray-200 pt-2 text-center text-[9px] text-gray-500">
          Bulletin de paie informatique — à conserver sans limitation de durée.
          Document généré le {formatDate(record.createdAt)} ·
          {record.status === PayrollStatus.PAYE
            ? ` Payé le ${formatDate(record.updatedAt)}`
            : ` Statut : ${record.status}`}
        </footer>
      </article>
    </div>
  );
}

// ============================================================
//  Cellule "label / valeur" du bandeau identité
// ============================================================
function FieldCell({
  label,
  value,
  small,
  center,
  bold,
  mono,
}: {
  label: string;
  value: string | number;
  small?: boolean;
  center?: boolean;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={center ? "text-center" : ""}>
      <div
        className={`uppercase tracking-wider text-gray-500 ${small ? "text-[9px]" : "text-[10px]"}`}
      >
        {label}
      </div>
      <div
        className={`${bold ? "font-semibold" : ""} ${mono ? "font-mono" : ""} text-gray-900 ${small ? "text-[11px]" : "text-[12px]"}`}
      >
        {value}
      </div>
    </div>
  );
}
