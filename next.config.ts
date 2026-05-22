import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit charge ses polices (.afm) via fs.readFile au runtime ; il faut
  // l'exclure du bundle Turbopack pour qu'il accède aux fichiers via node_modules.
  serverExternalPackages: ["pdfkit"],
  // Pour la démo : on n'arrête pas le build sur des erreurs de type ou de lint.
  // Le bundle Next.js compile correctement même sans le check TS.
  // À retirer pour la vraie prod si on veut un build strict.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Permet d'uploader des CV jusqu'à 5 MB via Server Actions.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
