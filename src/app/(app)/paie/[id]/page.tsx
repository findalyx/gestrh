import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { canViewPayroll } from "@/lib/payroll-access";
import { getOrganization } from "@/lib/organization";
import { PayrollStatusBadge } from "../_components/PayrollBadge";
import {
  MarkPaidButton,
  ValidateButton,
} from "../_components/PayrollActions";

export const dynamic = "force-dynamic";

const FCFA = new Intl.NumberFormat("fr-FR");

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return FCFA.format(n);
}

function fmtPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  const month = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
  return month.charAt(0).toUpperCase() + month.slice(1);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
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
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          jobTitle: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  if (!record) notFound();

  const allowed = await canViewPayroll(record.agentId);
  if (!allowed) redirect("/paie");

  const organization = await getOrganization();
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;

  // Valeurs telles qu'importées (source de vérité = le PDF original). Aucun
  // recalcul : le brut, les cotisations et le net affichés sont ceux du
  // bulletin importé, identiques à la liste.
  const gross = record.baseSalary + record.bonuses + record.allowances;
  const period = fmtPeriod(record.period);

  return (
    <div className="space-y-4">
      {/* Barre de navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
          <Link href="/paie" className="hover:text-sc-blue">
            Paie
          </Link>
          <span>/</span>
          <span className="text-sc-blue-darker">
            {record.agent.firstName} {record.agent.lastName} · {period}
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
          {record.pdfUrl && (
            <a
              href={`/api/paie/${record.id}/bulletin`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-sc-blue px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-sc-blue-dark"
            >
              Ouvrir le PDF
            </a>
          )}
        </div>
      </div>

      {/* Récapitulatif (valeurs importées) */}
      <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sc-border pb-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-sc-blue-darker">
              {record.agent.lastName.toUpperCase()} {record.agent.firstName}
            </h2>
            <p className="text-[12.5px] text-gray-600">
              {record.agent.jobTitle} · {record.agent.service.name} ·{" "}
              <span className="font-mono">{record.agent.matricule}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wider text-gray-500">
              Période
            </p>
            <p className="font-serif text-[15px] font-semibold text-sc-blue-darker">
              {period}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-sc-border bg-gray-50/60 p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Brut
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-sc-blue-darker">
              {fmt(gross)}
            </p>
            <p className="text-[11px] text-gray-400">FCFA</p>
          </div>
          <div className="rounded-lg border border-sc-border bg-gray-50/60 p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Cotisations salariales
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-gray-700">
              −{fmt(record.deductions)}
            </p>
            <p className="text-[11px] text-gray-400">FCFA</p>
          </div>
          <div className="rounded-lg border border-sc-green/30 bg-sc-green-light p-4">
            <p className="text-[11px] uppercase tracking-wider text-sc-green-dark">
              Net à payer
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-sc-green-dark">
              {fmt(record.netSalary)}
            </p>
            <p className="text-[11px] text-sc-green-dark/70">FCFA</p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400">
          Valeurs issues du bulletin importé. Le document officiel ci-dessous
          fait foi.
          {record.status === PayrollStatus.PAYE
            ? ` Payé le ${formatDate(record.updatedAt)}.`
            : ` Statut : ${record.status}.`}
        </p>
      </section>

      {/* Bulletin original (PDF importé) */}
      {record.pdfUrl ? (
        <section className="overflow-hidden rounded-xl border border-sc-border bg-white shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div className="flex items-center justify-between border-b border-sc-border bg-sc-blue-bg px-4 py-2.5">
            <h3 className="text-[12.5px] font-semibold text-sc-blue-darker">
              Bulletin original (PDF)
            </h3>
            <a
              href={`/api/paie/${record.id}/bulletin`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-sc-blue hover:underline"
            >
              Ouvrir en plein écran →
            </a>
          </div>
          <iframe
            src={`/api/paie/${record.id}/bulletin`}
            title="Bulletin de paie original"
            className="h-[900px] w-full"
          />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-sc-border bg-white p-8 text-center">
          <p className="text-[13px] text-gray-500">
            Aucun PDF original n&apos;est rattaché à ce bulletin.
          </p>
          <p className="mt-1 text-[12px] text-gray-400">
            Importez le PDF mensuel des bulletins depuis la page Paie pour
            l&apos;associer à cet enregistrement.
          </p>
        </section>
      )}
    </div>
  );
}
