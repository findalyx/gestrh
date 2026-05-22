import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { AgentForm } from "../_components/AgentForm";
import { createAgent } from "../_lib/actions";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <a href="/personnel" className="hover:text-sc-blue">
          Personnel
        </a>
        <span>/</span>
        <span className="text-sc-blue-darker">Nouvelle fiche</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Création d&apos;une fiche agent
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Le matricule sera attribué automatiquement à l&apos;enregistrement
          selon la catégorie choisie.
        </p>
      </header>

      <AgentForm
        services={services}
        defaults={{}}
        submitLabel="Créer la fiche"
        cancelHref="/personnel"
        action={createAgent}
      />
    </div>
  );
}
