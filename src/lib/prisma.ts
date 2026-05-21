import { PrismaClient } from "@prisma/client";

// Client Prisma en singleton : évite d'ouvrir un nouveau pool de
// connexions PostgreSQL à chaque rechargement à chaud en développement.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
