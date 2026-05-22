import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal";
import { DirectionDashboard } from "./_components/DirectionDashboard";
import { ManagerDashboard } from "./_components/ManagerDashboard";
import { AgentDashboard } from "./_components/AgentDashboard";
import { DashboardTabs, type DashboardView } from "./_components/DashboardTabs";

export const dynamic = "force-dynamic";

type SearchParams = { vue?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();

  // AGENT : dashboard personnel uniquement
  if (me.role === Role.AGENT) {
    if (!me.agent) {
      return <MissingAgentWarning role="Agent" />;
    }
    return <AgentDashboard agentId={me.agent.id} firstName={me.agent.firstName} />;
  }

  // MANAGER : deux vues sous forme d'onglets
  if (me.role === Role.MANAGER) {
    if (!me.agent) {
      return <MissingAgentWarning role="Manager" />;
    }
    const view: DashboardView = sp.vue === "personnel" ? "personnel" : "equipe";
    return (
      <div className="space-y-5">
        <DashboardTabs current={view} />
        {view === "personnel" ? (
          <AgentDashboard agentId={me.agent.id} firstName={me.agent.firstName} />
        ) : (
          <ManagerDashboard
            managerAgentId={me.agent.id}
            firstName={me.agent.firstName}
          />
        )}
      </div>
    );
  }

  // DIRECTION + DRH : vue stratégique
  return <DirectionDashboard />;
}

function MissingAgentWarning({ role }: { role: string }) {
  return (
    <div className="rounded-xl border border-sc-warning/30 bg-sc-warning-light p-5 text-[13px] text-[#854f0b]">
      Votre compte {role} n&apos;est pas relié à une fiche agent. Contactez la DRH.
    </div>
  );
}
