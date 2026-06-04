import { materializeAlerts } from "@/lib/contract-alerts";

export const dynamic = "force-dynamic";

/**
 * Endpoint à invoquer une fois par jour pour matérialiser les alertes
 * contractuelles en notifications Direction/DRH.
 *
 * Schémas d'authentification acceptés :
 *  - `Authorization: Bearer <CRON_SECRET>` (utilisé par les Cron Vercel).
 *  - `x-cron-secret: <CRON_SECRET>` (appel manuel ou service externe).
 *
 * Si CRON_SECRET n'est pas défini sur le serveur, l'accès est refusé
 * par défaut (sécurité-first).
 */
async function runAlerts(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET non configuré sur le serveur.", {
      status: 503,
    });
  }
  const bearer = request.headers.get("authorization");
  const xHeader = request.headers.get("x-cron-secret");
  const ok =
    xHeader === expected ||
    (bearer && bearer === `Bearer ${expected}`);
  if (!ok) {
    return new Response("Forbidden", { status: 403 });
  }

  const report = await materializeAlerts();
  return Response.json({
    ok: true,
    cddNotifications: report.cddCreated,
    retirementNotifications: report.retirementCreated,
    recipients: report.recipients,
    timestamp: new Date().toISOString(),
  });
}

export const POST = runAlerts;
// Vercel Cron Jobs utilisent GET — on accepte les deux verbes.
export const GET = runAlerts;
