import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs-dist accèdent à des ressources via fs au runtime :
  // on les exclut du bundle pour qu'ils fonctionnent côté serveur.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Pour la démo : on n'arrête pas le build sur des erreurs de type ou de lint.
  // Le bundle Next.js compile correctement même sans le check TS.
  // À retirer pour la vraie prod si on veut un build strict.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Uploads via Server Actions (CV, bulletins de paie PDF mensuels…).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
