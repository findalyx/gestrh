import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { CourseForm } from "../../_components/CourseForm";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const { id } = await params;

  const course = await prisma.trainingCourse.findUnique({
    where: { id },
  });

  if (!course) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/formation" className="hover:text-sc-blue">
          Formation
        </Link>
        <span>/</span>
        <Link
          href={`/formation/${course.id}`}
          className="hover:text-sc-blue"
        >
          {course.title}
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">Modifier</span>
      </div>

      <header>
        <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
          Modifier le cours
        </h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Les modules pédagogiques se gèrent depuis la fiche du cours.
        </p>
      </header>

      <CourseForm
        editing={{ id: course.id }}
        defaults={{
          title: course.title,
          category: course.category,
          description: course.description,
          isInternal: course.isInternal,
          instructor: course.instructor,
          objectives: course.objectives,
          durationHours: course.durationHours,
        }}
      />
    </div>
  );
}
