import Link from "next/link";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/dal";
import { CourseForm } from "../_components/CourseForm";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireRole(Role.DIRECTION, Role.DRH);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/formation" className="hover:text-sc-blue">
          Formation
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">Nouveau cours</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Ajouter un cours au catalogue
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Une fois le cours créé, vous pourrez y ajouter une ou plusieurs sessions
          (dates, lieu, capacité).
        </p>
      </header>

      <CourseForm />
    </div>
  );
}
