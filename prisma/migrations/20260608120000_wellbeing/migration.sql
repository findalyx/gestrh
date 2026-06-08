-- Espace de vie / bien-être : avis anonymes des employés
-- (idempotent — réexécutable sans risque)

DO $$ BEGIN
  CREATE TYPE "WellbeingTopic" AS ENUM ('ENVIRONNEMENT', 'AMELIORATION', 'RECONNAISSANCE', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WellbeingStatus" AS ENUM ('NOUVEAU', 'LU', 'TRAITE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "WellbeingPost" (
  "id"        TEXT NOT NULL,
  "topic"     "WellbeingTopic" NOT NULL DEFAULT 'AUTRE',
  "message"   TEXT NOT NULL,
  "status"    "WellbeingStatus" NOT NULL DEFAULT 'NOUVEAU',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WellbeingPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WellbeingPost_status_idx" ON "WellbeingPost"("status");
CREATE INDEX IF NOT EXISTS "WellbeingPost_createdAt_idx" ON "WellbeingPost"("createdAt");
