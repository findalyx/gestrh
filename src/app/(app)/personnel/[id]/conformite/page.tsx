import { notFound } from "next/navigation";
import { getAgentDetail } from "@/lib/personnel";
import { runChecks, STATUS_LABEL, STATUS_STYLE } from "@/lib/compliance";
import { Icon } from "@/components/Icon";
import { AgentSubNav } from "../../_components/AgentSubNav";

export const dynamic = "force-dynamic";

export default async function AgentConformitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgentDetail(id);
  if (!agent) notFound();
  const checks = runChecks(agent);
  const agentName = `${agent.lastName.toUpperCase()} ${agent.firstName}`;

  const counts = checks.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const overall = counts.fail > 0 ? "fail" : counts.warn > 0 ? "warn" : "pass";

  return (
    <div>
      <AgentSubNav agentId={agent.id} active="conformite" agentName={agentName} />
      <div className="space-y-4">
        <div className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-serif text-[15px] font-semibold text-sc-blue-darker">
                <Icon name="compliance" size={16} /> Audit de conformité
              </h3>
              <p className="mt-1 text-[12px] text-gray-600">
                Contrôles automatiques basés sur le code du travail sénégalais
                (articles L.43 et suivants), la convention collective applicable
                et les pièces requises au dossier.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${STATUS_STYLE[overall]}`}
            >
              {STATUS_LABEL[overall]}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
            {(["pass", "warn", "fail", "na"] as const).map((s) => (
              <div
                key={s}
                className={`rounded-md px-2 py-1.5 text-center ${STATUS_STYLE[s]}`}
              >
                <div className="text-[16px] font-bold leading-none">
                  {counts[s] ?? 0}
                </div>
                <div className="mt-0.5 font-semibold uppercase tracking-wide">
                  {STATUS_LABEL[s]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-sc-border bg-white px-4 py-3 shadow-[0_1px_2px_rgba(51,89,164,0.06)]"
            >
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[c.status]}`}
              >
                {STATUS_LABEL[c.status]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-sc-blue-darker">
                  {c.label}
                </div>
                <div className="text-[11px] text-gray-600">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
