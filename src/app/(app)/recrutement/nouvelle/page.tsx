import Link from "next/link";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { JobPostingForm } from "../_components/JobPostingForm";

export const dynamic = "force-dynamic";

export default async function NewJobPostingPage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/recrutement" className="hover:text-sc-blue">
          Recrutement
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">Nouvelle offre</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Publier une offre d&apos;emploi
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Une fois l&apos;offre publiée, vous pourrez y enregistrer manuellement
          les candidats reçus et les faire avancer dans le pipeline.
        </p>
      </header>

      <JobPostingForm services={services} />
    </div>
  );
}
