import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { AgentForm } from "../_components/AgentForm";
import { createAgent } from "../_lib/actions";

export const dynamic = "force-dynamic";

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ matricule?: string }>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);

  const sp = await searchParams;
  const presetMatricule = sp.matricule?.trim() || undefined;

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
          {presetMatricule
            ? "Matricule pré-renseigné depuis un bulletin non rattaché : complétez la fiche pour relier ses bulletins."
            : "Laissez le matricule vide pour une attribution automatique selon la catégorie."}
        </p>
      </header>

      {presetMatricule && (
        <div className="rounded-lg border border-sc-warning/40 bg-sc-warning-light px-4 py-2.5 text-[12.5px] text-[#854f0b]">
          Une fois la fiche créée avec le matricule{" "}
          <span className="font-mono font-semibold">{presetMatricule}</span>,
          ré-importez le même PDF de bulletins : la période sera mise à jour et
          ses bulletins se rattacheront automatiquement.
        </div>
      )}

      <AgentForm
        services={services}
        defaults={{ matricule: presetMatricule }}
        submitLabel="Créer la fiche"
        cancelHref="/personnel"
        action={createAgent}
      />
    </div>
  );
}
