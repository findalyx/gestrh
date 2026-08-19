import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { buildEsgExport, type EsgReportData } from "@/app/(app)/esg/_lib/export";

export const dynamic = "force-dynamic";

type WithAnswers = {
  period: string;
  label: string;
  answers: { metricKey: string; value: string; comment: string }[];
};

function toData(r: WithAnswers): EsgReportData {
  return {
    period: r.period,
    label: r.label,
    answers: Object.fromEntries(
      r.answers.map((a) => [a.metricKey, { value: a.value, comment: a.comment }]),
    ),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole(Role.DIRECTION, Role.DRH);
  const { id } = await params;

  const report = await prisma.esgReport.findUnique({
    where: { id },
    include: { answers: true },
  });
  if (!report) {
    return new Response("Rapport introuvable", { status: 404 });
  }

  // Jusqu'à 4 trimestres antérieurs (période < courante, plus récent d'abord).
  const history = await prisma.esgReport.findMany({
    where: { period: { lt: report.period } },
    orderBy: { period: "desc" },
    take: 4,
    include: { answers: true },
  });

  const buffer = await buildEsgExport(
    toData(report),
    history.map(toData),
  );

  const filename = `ESG_${report.period}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
