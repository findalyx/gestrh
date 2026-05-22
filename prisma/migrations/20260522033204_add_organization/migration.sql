-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "tagline" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Sénégal',
    "ninea" TEXT,
    "rccm" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoFilename" TEXT,
    "logoMimeType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
