import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { assertAgentVisible } from "@/lib/personnel-access";
import {
  AgentStatusBadge,
  CategoryBadge,
  ContractStatusBadge,
  ContractTypeLabel,
} from "@/components/Badges";
import { Icon } from "@/components/Icon";
import { Role, type Gender, type StaffSubCategory } from "@prisma/client";
import {
  DeleteContractPdfButton,
  GenerateContractPdfButton,
  NewContractForm,
  UploadContractPdfForm,
} from "../_components/ContractForm";

export const dynamic = "force-dynamic";

const SUB_CATEGORY_LABEL: Record<StaffSubCategory, string> = {
  PER_ENSEIGNEMENT: "Enseignement",
  PER_RECHERCHE: "Recherche",
  PATS_ADMINISTRATIF: "Administratif",
  PATS_TECHNIQUE: "Technique",
};

const GENDER_LABEL: Record<Gender, string> = {
  HOMME: "Homme",
  FEMME: "Femme",
};

const FCFA = new Intl.NumberFormat("fr-FR");

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

function yearsBetween(start: Date, end: Date | null | undefined): string {
  const e = end ?? new Date();
  const years = (e.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} mois`;
  }
  return `${years.toFixed(1).replace(".", ",")} ans`;
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await assertAgentVisible(id);
  const me = await getCurrentUser();
  const canEdit = me.role === Role.DIRECTION || me.role === Role.DRH;

  const currentYear = new Date().getFullYear();

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      service: { select: { name: true, code: true } },
      contracts: { orderBy: { startDate: "desc" } },
      careerEntries: { orderBy: { startDate: "desc" } },
      leaveBalances: {
        where: { year: currentYear },
        orderBy: { type: "asc" },
      },
    },
  });

  if (!agent) notFound();

  const initials = `${agent.firstName[0]}${agent.lastName[0]}`.toUpperCase();
  const activeContract = agent.contracts.find((c) => c.status === "ACTIF");
  const seniority = yearsBetween(agent.hireDate, null);

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/personnel" className="hover:text-sc-blue">
          Personnel
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">
          {agent.lastName.toUpperCase()} {agent.firstName}
        </span>
      </div>

      {/* Accès rapide aux sous-sections workflow contrats */}
      <nav className="flex flex-wrap gap-1 rounded-lg border border-sc-border bg-white p-1.5">
        {[
          { seg: "avenants", label: "Avenants" },
          { seg: "renouvellement", label: "Renouvellement" },
          { seg: "documents", label: "Documents" },
          { seg: "notifications", label: "Notifications" },
          { seg: "demission", label: "Démission" },
          { seg: "conformite", label: "Conformité" },
        ].map((s) => (
          <Link
            key={s.seg}
            href={`/personnel/${id}/${s.seg}`}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker transition hover:bg-sc-blue-light"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {/* En-tête fiche */}
      <div className="flex flex-wrap items-start gap-5 rounded-xl border border-sc-border bg-white p-6 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sc-purple to-sc-blue text-2xl font-semibold text-white">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-2xl font-semibold text-sc-blue-darker">
            {agent.firstName} {agent.lastName}
          </h2>
          <p className="mt-1 text-[13.5px] text-gray-700">{agent.jobTitle}</p>
          <p className="mt-0.5 text-[12.5px] text-gray-500">
            {agent.service.name} · Matricule{" "}
            <span className="font-mono">{agent.matricule}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CategoryBadge value={agent.category} />
            <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider text-gray-600">
              {SUB_CATEGORY_LABEL[agent.subCategory]}
            </span>
            <AgentStatusBadge value={agent.status} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {canEdit && (
            <Link
              href={`/personnel/${id}/modifier`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
            >
              <Icon name="settings" size={13} />
              Modifier
            </Link>
          )}
          <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
            Ancienneté
          </p>
          <p className="font-serif text-lg font-semibold text-sc-blue-darker">
            {seniority}
          </p>
          <p className="text-[11.5px] text-gray-500">
            Embauché le {formatDate(agent.hireDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Informations personnelles */}
        <Section icon="users" title="Informations personnelles">
          <Field label="Email">{agent.email}</Field>
          <Field label="Téléphone">{agent.phone ?? "—"}</Field>
          <Field label="Sexe">{GENDER_LABEL[agent.gender]}</Field>
          <Field label="Date de naissance">{formatDate(agent.birthDate)}</Field>
          <Field label="Adresse">{agent.address ?? "—"}</Field>
        </Section>

        {/* Affectation */}
        <Section icon="dashboard" title="Affectation">
          <Field label="Service">
            {agent.service.name}{" "}
            <span className="text-gray-400">({agent.service.code})</span>
          </Field>
          <Field label="Poste">{agent.jobTitle}</Field>
          <Field label="Catégorie">
            {agent.category} · {SUB_CATEGORY_LABEL[agent.subCategory]}
          </Field>
          {activeContract && (
            <>
              <Field label="Contrat actif">
                <ContractTypeLabel value={activeContract.type} />
                {activeContract.grade && (
                  <span className="text-gray-500"> · {activeContract.grade}</span>
                )}
              </Field>
              <Field label="Salaire de base">
                {FCFA.format(activeContract.baseSalary)} FCFA
              </Field>
            </>
          )}
        </Section>
      </div>

      {/* Contrats */}
      <Section icon="payroll" title={`Contrats (${agent.contracts.length})`}>
        {agent.contracts.length === 0 ? (
          <p className="text-[13px] text-gray-500">Aucun contrat enregistré.</p>
        ) : (
          <div className="space-y-2">
            {agent.contracts.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-sc-border bg-sc-blue-bg/30 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-gray-500">
                      {c.reference}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <ContractTypeLabel value={c.type} />
                      <ContractStatusBadge value={c.status} />
                      {c.grade && (
                        <span className="text-[12px] text-gray-700">
                          {c.grade}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-gray-700">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)} ·{" "}
                      <span className="font-mono">
                        {FCFA.format(c.baseSalary)} FCFA
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <a
                      href={`/api/contract/${c.id}/docx`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sc-border bg-white px-2.5 py-1 text-[11.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-light"
                    >
                      📝 Générer en Word
                    </a>
                    {c.pdfFilename ? (
                      <>
                        <a
                          href={`/api/contract/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sc-blue px-2.5 py-1 text-[11.5px] font-medium text-white transition hover:bg-sc-blue-dark"
                        >
                          📄 Voir le PDF
                        </a>
                        <span
                          className={
                            c.pdfGenerated
                              ? "text-[10.5px] text-gray-500"
                              : "text-[10.5px] font-medium text-sc-green-dark"
                          }
                        >
                          {c.pdfGenerated
                            ? "Auto-généré · à signer"
                            : "✓ Scan signé téléversé"}
                        </span>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <GenerateContractPdfButton
                              contractId={c.id}
                              hasPdf
                              isSignedScan={!c.pdfGenerated}
                            />
                            <details className="text-right">
                              <summary className="cursor-pointer text-[10.5px] text-sc-blue hover:underline">
                                Téléverser scan signé
                              </summary>
                              <div className="mt-1">
                                <UploadContractPdfForm contractId={c.id} />
                              </div>
                            </details>
                            <DeleteContractPdfButton contractId={c.id} />
                          </div>
                        )}
                      </>
                    ) : canEdit ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <GenerateContractPdfButton
                          contractId={c.id}
                          hasPdf={false}
                          isSignedScan={false}
                        />
                        <details>
                          <summary className="cursor-pointer text-[10.5px] text-sc-blue hover:underline">
                            …ou téléverser un scan signé
                          </summary>
                          <div className="mt-1">
                            <UploadContractPdfForm contractId={c.id} />
                          </div>
                        </details>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Aucun PDF joint
                      </span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <details className="mt-3 border-t border-sc-border/60 pt-2">
                    <summary className="cursor-pointer text-[11.5px] font-medium text-sc-blue hover:underline">
                      Modifier ce contrat
                    </summary>
                    <div className="mt-3">
                      <NewContractForm
                        editing={{ contractId: c.id }}
                        defaults={{
                          type: c.type,
                          status: c.status,
                          startDate: c.startDate,
                          endDate: c.endDate,
                          grade: c.grade,
                          baseSalary: c.baseSalary,
                        }}
                      />
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <details className="mt-4 rounded-xl border border-sc-border bg-white">
            <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-semibold text-sc-blue-darker">
              + Ajouter un contrat
            </summary>
            <div className="border-t border-sc-border p-4">
              <NewContractForm agentId={agent.id} />
            </div>
          </details>
        )}
      </Section>

      {/* Historique de carrière */}
      <Section
        icon="training"
        title={`Historique de carrière (${agent.careerEntries.length})`}
      >
        {agent.careerEntries.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Aucune entrée d&apos;historique.
          </p>
        ) : (
          <ol className="space-y-3">
            {agent.careerEntries.map((c) => (
              <li
                key={c.id}
                className="flex gap-3 border-l-2 border-sc-blue-light pl-4"
              >
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-sc-blue-darker">
                    {c.jobTitle}
                  </p>
                  <p className="text-[12px] text-gray-500">
                    {formatDate(c.startDate)} →{" "}
                    {c.endDate ? formatDate(c.endDate) : "en cours"}
                  </p>
                  {c.notes && (
                    <p className="mt-1 text-[12px] text-gray-600">{c.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Soldes de congés */}
      <Section
        icon="calendar"
        title={`Soldes de congés ${currentYear}`}
      >
        {agent.leaveBalances.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Aucun solde enregistré pour {currentYear}.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agent.leaveBalances.map((b) => {
              const remaining = b.totalDays - b.usedDays;
              const pct =
                b.totalDays > 0
                  ? Math.min(100, Math.round((b.usedDays / b.totalDays) * 100))
                  : 0;
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-sc-border bg-white p-3"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-600">
                      {b.type.replace("_", " ").toLowerCase()}
                    </p>
                    <p className="font-serif text-base font-semibold text-sc-blue-darker">
                      {remaining}
                      <span className="text-[11px] text-gray-500">
                        {" "}
                        / {b.totalDays} j
                      </span>
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-sc-teal"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {b.usedDays} j utilisés
                  </p>
                </div>
              );
            })}
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
      <h3 className="mb-4 flex items-center gap-2.5 font-serif text-base font-semibold text-sc-blue-darker">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
          <Icon name={icon} size={14} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-sc-border/60 py-2 last:border-b-0 text-[13px]">
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-gray-800">{children}</span>
    </div>
  );
}
