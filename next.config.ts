import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit charge ses polices (.afm) via fs.readFile au runtime ; il faut
  // l'exclure du bundle Turbopack pour qu'il accède aux fichiers via node_modules.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    // Permet d'uploader des CV jusqu'à 5 MB via Server Actions.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
