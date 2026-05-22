import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Nettoie le cookie de session et redirige vers /login.
 *
 * Appelé :
 *   - depuis le DAL quand l'utilisateur correspondant au cookie n'existe plus
 *     (par exemple après un re-seed de la base)
 *   - manuellement si on a besoin de purger une session côté serveur
 */
export async function GET(request: Request) {
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
