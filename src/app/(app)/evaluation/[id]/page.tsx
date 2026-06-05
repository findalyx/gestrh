import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EvaluationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  canEditEvaluation,
  getEvaluationScopeWhere,
} from "@/lib/evaluation-access";
import {
  formatScore,
  perfCategory,
  PERF_LABEL,
  PERF_STYLE,
} from "@/lib/performance";
import { EvaluationStatusBadge } from "../_components/EvaluationBadge";
import { EvaluationForm } from "../_components/EvaluationForm";
import { ReopenButton } from "../_components/ReopenButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

type SearchParams = { finalized?: string };

export default async function EvaluationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getCurrentUser();

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          jobTitle: true,
          category: true,
          service: { select: { name: true, code: true } },
        },
      },
      evaluator: {
        select: { firstName: true, lastName: true, matricule: true },
      },
    },
  });

  if (!evaluation) notFound();

  // Vérifie que l'utilisateur a le droit de voir cette évaluation
  // (via le filtre de scope, on s'assure que l'id est dans le périmètre)
  const { where: scopeWhere } = await getEvaluationScopeWhere();
  const visible = await prisma.evaluation.count({
    where: { AND: [scopeWhere, { id }] },
  });
  if (visible === 0) redirect("/evaluation");

  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const canEdit = await canEditEvaluation({
    evaluatorId: evaluation.evaluatorId,
    status: evaluation.status,
  });

  return (
    <div className="space-y-6">
      {sp.finalized && (
        <div className="rounded-xl border border-sc-green/30 bg-sc-green-light px-4 py-3 text-[13px] text-sc-green-dark">
          ✓ Évaluation finalisée. Elle est désormais consultable par l&apos;agent
          évalué et par la DRH.
        </div>
      )}

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/evaluation" className="hover:text-sc-blue">
          Évaluation
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">
          {evaluation.agent.lastName.toUpperCase()} {evaluation.agent.firstName}{" "}
          · {evaluation.period}
        </span>
      </div>

      {/* En-tête évaluation */}
      <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Évaluation annuelle · campagne {evaluation.period}
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-sc-blue-darker">
              {evaluation.agent.firstName} {evaluation.agent.lastName}
            </h2>
            <p className="text-[13px] text-gray-700">
              {evaluation.agent.jobTitle}
            </p>
            <p className="mt-0.5 text-[12px] text-gray-500">
              {evaluation.agent.service.name} · Matricule{" "}
              <span className="font-mono">{evaluation.agent.matricule}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EvaluationStatusBadge
              status={evaluation.status}
              dueDate={evaluation.dueDate}
              completedAt={evaluation.completedAt}
            />
            {evaluation.highPotential && (
              <span className="rounded-full bg-sc-purple-light px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-wider text-sc-purple">
                ★ Haut potentiel
              </span>
            )}
            {isAdmin && evaluation.status === EvaluationStatus.TERMINEE && (
              <ReopenButton evaluationId={evaluation.id} />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-sc-border pt-4 text-[12.5px] md:grid-cols-4">
          <InfoCol
            label="Évaluateur"
            value={
              evaluation.evaluator
                ? `${evaluation.evaluator.firstName} ${evaluation.evaluator.lastName}`
                : "Non désigné"
            }
          />
          <InfoCol
            label="Échéance"
            value={formatDate(evaluation.dueDate)}
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Note globale
            </p>
            {evaluation.overallScore !== null ? (
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-gray-700">
                  {formatScore(evaluation.overallScore)} / 20
                </span>
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    PERF_STYLE[perfCategory(evaluation.overallScore)]
                  }`}
                >
                  {PERF_LABEL[perfCategory(evaluation.overallScore)]}
                </span>
              </div>
            ) : (
              <p className="mt-0.5 text-gray-700">—</p>
            )}
          </div>
          <InfoCol
            label="Finalisée le"
            value={formatDate(evaluation.completedAt)}
          />
        </div>
      </div>

      {/* Formulaire (si édition possible) ou lecture seule */}
      {canEdit && evaluation.status !== EvaluationStatus.TERMINEE ? (
        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <h3 className="mb-4 font-serif text-base font-semibold text-sc-blue-darker">
            Saisie de l&apos;évaluation
          </h3>
          <p className="mb-4 text-[12px] text-gray-600">
            Vous pouvez enregistrer en brouillon pour reprendre plus tard, ou
            finaliser une fois la note posée. Une fois finalisée, seule la DRH
            peut ré-ouvrir l&apos;évaluation.
          </p>
          <EvaluationForm
            evaluationId={evaluation.id}
            initialValues={{
              objectives: evaluation.objectives ?? "",
              comments: evaluation.comments ?? "",
              overallScore: evaluation.overallScore,
              highPotential: evaluation.highPotential,
            }}
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ReadOnlySection title="Objectifs individuels">
            {evaluation.objectives || <EmptyText>Aucun objectif renseigné.</EmptyText>}
          </ReadOnlySection>
          <ReadOnlySection title="Commentaires de l'évaluateur">
            {evaluation.comments || <EmptyText>Aucun commentaire renseigné.</EmptyText>}
          </ReadOnlySection>
        </div>
      )}
    </div>
  );
}

function InfoCol({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-gray-700">{value}</p>
    </div>
  );
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <h3 className="mb-3 font-serif text-base font-semibold text-sc-blue-darker">
        {title}
      </h3>
      <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <span className="text-[12.5px] text-gray-400">{children}</span>;
}
