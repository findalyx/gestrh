import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { assertAgentVisible } from "@/lib/personnel-access";
import { AgentForm } from "../../_components/AgentForm";
import { updateAgent } from "../../_lib/actions";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(Role.DIRECTION, Role.DRH);
  await assertAgentVisible(id);

  const [agent, services] = await Promise.all([
    prisma.agent.findUnique({ where: { id } }),
    prisma.service.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (!agent) notFound();

  const action = updateAgent.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <a href="/personnel" className="hover:text-sc-blue">
          Personnel
        </a>
        <span>/</span>
        <a href={`/personnel/${id}`} className="hover:text-sc-blue">
          {agent.lastName.toUpperCase()} {agent.firstName}
        </a>
        <span>/</span>
        <span className="text-sc-blue-darker">Modifier</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Modifier la fiche
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Les modifications sont enregistrées dans le journal d&apos;audit.
        </p>
      </header>

      <AgentForm
        services={services}
        matricule={agent.matricule}
        defaults={{
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          phone: agent.phone ?? "",
          address: agent.address ?? "",
          gender: agent.gender,
          birthDate: toDateInput(agent.birthDate),
          birthPlace: agent.birthPlace ?? "",
          nationality: agent.nationality ?? "",
          maritalStatus: agent.maritalStatus ?? "",
          category: agent.category,
          subCategory: agent.subCategory,
          jobTitle: agent.jobTitle,
          serviceId: agent.serviceId,
          status: agent.status,
          hireDate: toDateInput(agent.hireDate),
        }}
        submitLabel="Enregistrer"
        cancelHref={`/personnel/${id}`}
        action={action}
      />
    </div>
  );
}
