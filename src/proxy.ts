import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

/**
 * Garde-fou d'authentification optimiste :
 *   - décode le JWT du cookie de session
 *   - redirige vers /login si absent / invalide / expiré
 *   - redirige vers /tableau-de-bord si déjà connecté et sur /login
 *
 * En cas de cookie présent mais invalide (signature, expiration), on nettoie
 * le cookie pour éviter les boucles de redirection.
 *
 * La vérification finale (existence du compte en base) est faite par le DAL
 * (src/lib/dal.ts), qui peut rediriger vers /api/auth/logout si le compte
 * n'existe plus.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const session = cookieValue ? await decrypt(cookieValue) : null;
  const isAuthenticated =
    session !== null && session.expiresAt > Date.now();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    // Cookie présent mais invalide : on l'efface pour éviter la boucle
    if (cookieValue) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"],
};
