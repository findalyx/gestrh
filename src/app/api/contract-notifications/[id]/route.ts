import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { buildNotificationDocx } from "@/lib/docx/notification";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await verifySession();
  const { id } = await params;

  const n = await prisma.contractNotification.findUnique({
    where: { id },
    include: {
      contract: { include: { agent: { include: { service: true } } } },
    },
  });
  if (!n) return new Response("Notification introuvable.", { status: 404 });

  const { bytes, subject } = await buildNotificationDocx(
    n.kind,
    n.contract.agent,
    n.contract,
    n.contract.agent.service,
    {},
  );
  const fileName = `${subject.replace(/\s+/g, "_")}_${n.contract.reference}.docx`;

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
