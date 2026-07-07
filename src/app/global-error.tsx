"use client";

/**
 * Global error boundary — dernier recours quand même le layout racine plante.
 * Doit rendre son propre <html>/<body> car il remplace tout l'arbre React.
 * Inline les styles pour ne pas dépendre du bundle CSS qui pourrait être HS.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#f7f9fc",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: "32px 24px",
            textAlign: "center",
            background: "white",
            borderRadius: 12,
            border: "1px solid #e6ebf5",
            boxShadow: "0 4px 24px rgba(51,89,164,0.06)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "#fbe8e7",
              color: "#d9534f",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              color: "#1a3066",
              margin: "0 0 12px",
            }}
          >
            L&apos;application a rencontré un problème
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#586778",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            Une erreur inattendue est survenue. Nous t&apos;invitons à recharger
            la page. Si le problème persiste, transmets le code ci-dessous au
            support.
          </p>
          {error?.digest && (
            <p
              style={{
                fontSize: 12,
                color: "#94a3b8",
                margin: "0 0 20px",
                fontFamily: "monospace",
              }}
            >
              Référence : {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#3359a4",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Recharger l&apos;application
          </button>
        </div>
      </body>
    </html>
  );
}
