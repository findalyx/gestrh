import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { buildContractDocx } from "@/lib/docx/contract";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      agent: { include: { service: true } },
    },
  });
  if (!contract) return new Response("Contrat introuvable.", { status: 404 });

  const bytes = await buildContractDocx(
    contract,
    contract.agent,
    contract.agent.service,
  );
  const fileName = `${contract.reference}.docx`.replace(/\s+/g, "_");
  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
