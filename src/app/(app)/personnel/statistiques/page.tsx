import Link from "next/link";
import {
  ContractStatus,
  ContractType,
  StaffCategory,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { formatFcfa } from "@/lib/contract-utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ContractType, string> = {
  CDI: "CDI",
  CDD: "CDD",
  STAGE: "Stage",
  VACATAIRE: "Vacation",
};

const TYPE_COLOR: Record<ContractType, string> = {
  CDI: "bg-sc-blue",
  CDD: "bg-sc-purple",
  STAGE: "bg-sc-teal",
  VACATAIRE: "bg-sc-green",
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
      <h3 className="mb-4 flex items-center gap-2 font-serif text-[14px] font-semibold text-sc-blue-darker">
        <span className="h-[14px] w-1 rounded bg-sc-teal" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  color,
  rightLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  rightLabel?: string;
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 2;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-sc-blue-darker">{label}</span>
        <span className="font-semibold text-sc-blue-darker">
          {rightLabel ?? value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sc-blue-bg">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default async function StatistiquesPage() {
  const activeContracts = await prisma.contract.findMany({
    where: { status: ContractStatus.ACTIF },
    select: {
      type: true,
      baseSalary: true,
      agent: {
        select: {
          category: true,
          service: { select: { id: true, name: true } },
        },
      },
    },
  });

  const total = activeContracts.length;
  const totalMass = activeContracts.reduce((acc, c) => acc + c.baseSalary, 0);

  // Répartition par type
  const byType: Record<ContractType, number> = {
    CDI: 0,
    CDD: 0,
    STAGE: 0,
    VACATAIRE: 0,
  };
  // Masse par type
  const massByType: Record<ContractType, number> = {
    CDI: 0,
    CDD: 0,
    STAGE: 0,
    VACATAIRE: 0,
  };
  // Répartition par catégorie
  const byCategory: Record<StaffCategory, number> = { PER: 0, PATS: 0 };
  // Par service
  const byService = new Map<string, { name: string; count: number; mass: number }>();

  for (const c of activeContracts) {
    byType[c.type]++;
    massByType[c.type] += c.baseSalary;
    byCategory[c.agent.category]++;
    const s = byService.get(c.agent.service.id) ?? {
      name: c.agent.service.name,
      count: 0,
      mass: 0,
    };
    s.count++;
    s.mass += c.baseSalary;
    byService.set(c.agent.service.id, s);
  }
  const servicesSorted = Array.from(byService.values()).sort(
    (a, b) => b.mass - a.mass,
  );
  const serviceMaxCount = Math.max(1, ...servicesSorted.map((s) => s.count));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sc-blue-light text-sc-blue">
            <Icon name="dashboard" size={22} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold text-sc-blue-darker">
              Statistiques contractuelles
            </h2>
            <p className="text-[12px] text-gray-600">
              Photographie des contrats actifs · {total} contrats · masse
              salariale mensuelle brute {formatFcfa(totalMass)}
            </p>
          </div>
        </div>
        <Link
          href="/personnel"
          className="rounded-md border border-sc-border bg-white px-3 py-1.5 text-[12px] font-semibold text-sc-blue-darker hover:bg-sc-blue-light"
        >
          ← Liste agents
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Répartition par type de contrat">
          <div className="space-y-3">
            {(Object.keys(byType) as ContractType[]).map((k) => (
              <HBar
                key={k}
                label={TYPE_LABEL[k]}
                value={byType[k]}
                max={total}
                color={TYPE_COLOR[k]}
                rightLabel={`${byType[k]} (${total > 0 ? Math.round((byType[k] / total) * 100) : 0}%)`}
              />
            ))}
          </div>
        </Card>

        <Card title="Masse salariale par type">
          <div className="space-y-3">
            {(Object.keys(massByType) as ContractType[]).map((k) => (
              <HBar
                key={k}
                label={TYPE_LABEL[k]}
                value={massByType[k]}
                max={totalMass}
                color={TYPE_COLOR[k]}
                rightLabel={formatFcfa(massByType[k])}
              />
            ))}
          </div>
        </Card>

        <Card title="Catégorie PER / PATS">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-sc-blue-light p-4 text-center">
              <div className="text-[28px] font-bold leading-none text-sc-blue">
                {byCategory.PER}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-sc-blue">
                PER
              </div>
              <div className="mt-2 text-[11px] text-gray-600">
                {total > 0 ? Math.round((byCategory.PER / total) * 100) : 0} %
                de l&apos;effectif actif
              </div>
            </div>
            <div className="rounded-md bg-sc-purple-light p-4 text-center">
              <div className="text-[28px] font-bold leading-none text-sc-purple">
                {byCategory.PATS}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-sc-purple">
                PATS
              </div>
              <div className="mt-2 text-[11px] text-gray-600">
                {total > 0 ? Math.round((byCategory.PATS / total) * 100) : 0} %
                de l&apos;effectif actif
              </div>
            </div>
          </div>
        </Card>

        <Card title="Top services par masse salariale">
          <ul className="space-y-2">
            {servicesSorted.slice(0, 7).map((s) => (
              <li
                key={s.name}
                className="rounded-md bg-sc-blue-bg px-3 py-2 text-[12px]"
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-semibold text-sc-blue-darker">
                    {s.name}
                  </span>
                  <span className="text-gray-600">{formatFcfa(s.mass)}</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  {s.count} contrat{s.count > 1 ? "s" : ""} actif
                  {s.count > 1 ? "s" : ""}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Effectif par service (contrats actifs)">
          <div className="space-y-3">
            {servicesSorted.map((s) => (
              <HBar
                key={s.name}
                label={s.name}
                value={s.count}
                max={serviceMaxCount}
                color="bg-sc-teal"
                rightLabel={String(s.count)}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
