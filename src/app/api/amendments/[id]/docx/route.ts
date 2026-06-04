import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { buildAmendmentDocx } from "@/lib/docx/amendment";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;
  const a = await prisma.contractAmendment.findUnique({
    where: { id },
    include: { contract: { include: { agent: { include: { service: true } } } } },
  });
  if (!a) return new Response("Avenant introuvable.", { status: 404 });

  const bytes = await buildAmendmentDocx(
    a,
    a.contract,
    a.contract.agent,
    a.contract.agent.service,
  );
  const fileName = `${a.reference}.docx`.replace(/\s+/g, "_");
  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
