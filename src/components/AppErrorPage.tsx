"use client";

import Link from "next/link";

/**
 * Écran d'erreur amical et cohérent, réutilisé par toutes les error boundaries
 * de l'app ((app)/error.tsx, global-error.tsx, personnel/error.tsx, etc.).
 *
 * On tente d'interpréter le message d'erreur brut pour donner une explication
 * lisible à l'utilisateur, et on affiche l'identifiant technique (digest) pour
 * qu'il puisse être communiqué au support si besoin.
 */
export type AppErrorVariant = "generic" | "network" | "auth" | "notfound";

const VARIANT_CONTENT: Record<
  AppErrorVariant,
  { title: string; description: string; icon: React.ReactNode }
> = {
  generic: {
    title: "Une erreur s'est produite",
    description:
      "Le serveur n'a pas pu traiter cette requête. Réessayez dans un instant. Si le problème persiste, transmettez le code ci-dessous au support.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    ),
  },
  network: {
    title: "Connexion perdue",
    description:
      "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  auth: {
    title: "Session expirée",
    description:
      "Ta session n'est plus valide. Reconnecte-toi pour reprendre là où tu en étais.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  notfound: {
    title: "Page introuvable",
    description:
      "L'adresse demandée n'existe pas ou a été déplacée. Retour à l'accueil ?",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
};

/**
 * Devine automatiquement le type d'erreur à partir du message.
 */
function inferVariant(message: string | undefined): AppErrorVariant {
  const m = (message ?? "").toLowerCase();
  if (m.includes("fetch") || m.includes("network") || m.includes("connection"))
    return "network";
  if (
    m.includes("session") ||
    m.includes("unauthorized") ||
    m.includes("401") ||
    m.includes("not authenticated")
  )
    return "auth";
  if (m.includes("not found") || m.includes("404")) return "notfound";
  return "generic";
}

export function AppErrorPage({
  error,
  reset,
  variant,
  showDetails = false,
}: {
  error?: (Error & { digest?: string }) | null;
  reset?: () => void;
  variant?: AppErrorVariant;
  /** En dev seulement — affiche le message technique. */
  showDetails?: boolean;
}) {
  const detected = variant ?? inferVariant(error?.message);
  const content = VARIANT_CONTENT[detected];

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sc-danger-light text-sc-danger">
        <div className="h-7 w-7">{content.icon}</div>
      </div>

      <div className="max-w-md">
        <h1 className="font-serif text-xl font-semibold text-sc-blue-darker">
          {content.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
          {content.description}
        </p>

        {error?.digest && (
          <p className="mt-3 text-[11px] text-gray-400">
            Référence :{" "}
            <span className="font-mono font-semibold text-gray-500">
              {error.digest}
            </span>
          </p>
        )}

        {showDetails && error?.message && (
          <details className="mt-3 rounded-lg border border-sc-border bg-gray-50 px-3 py-2 text-left">
            <summary className="cursor-pointer text-[12px] font-medium text-sc-blue-darker">
              Détails techniques (dev)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto text-[11px] text-gray-700 whitespace-pre-wrap">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {reset && detected !== "auth" && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark"
          >
            Réessayer
          </button>
        )}
        {detected === "auth" ? (
          <Link
            href="/login"
            className="rounded-lg bg-sc-blue px-4 py-2 text-[13px] font-medium text-white transition hover:bg-sc-blue-dark"
          >
            Se reconnecter
          </Link>
        ) : (
          <Link
            href="/tableau-de-bord"
            className="rounded-lg border border-sc-border bg-white px-4 py-2 text-[13px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
          >
            Retour à l&apos;accueil
          </Link>
        )}
      </div>
    </div>
  );
}
