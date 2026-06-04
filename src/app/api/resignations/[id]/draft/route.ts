import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { buildResignationLetterDocx } from "@/lib/docx/resignation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;
  const r = await prisma.resignation.findUnique({
    where: { id },
    include: {
      contract: { include: { agent: { include: { service: true } } } },
    },
  });
  if (!r) return new Response("Démission introuvable.", { status: 404 });

  const bytes = await buildResignationLetterDocx(
    r.contract.agent,
    r.contract,
    r.contract.agent.service,
    {
      effectiveDate: r.effectiveDate,
      noticeStartDate: r.noticeStartDate,
      reason: r.reason,
    },
  );

  const fileName =
    `Demission_${r.contract.agent.lastName}_${r.contract.agent.firstName}.docx`.replace(
      /\s+/g,
      "_",
    );

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
