-- ============================================================
--  Congés — chaîne de validation Université St Christopher
--  Employé -> Chef de Service -> Doyen -> DG/Recteur -> Autorisé
--  (version idempotente : rejouable sans erreur)
-- ============================================================

-- 1) Nouveaux rôles
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RECTEUR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOYEN';

-- 2) Statuts congés : renommage des statuts existants (seulement s'ils
--    existent encore) vers la nouvelle chaîne, puis garantie d'existence.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'LeaveStatus' AND e.enumlabel = 'EN_ATTENTE_MANAGER') THEN
    ALTER TYPE "LeaveStatus" RENAME VALUE 'EN_ATTENTE_MANAGER' TO 'EN_ATTENTE_CHEF';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'LeaveStatus' AND e.enumlabel = 'EN_ATTENTE_DRH') THEN
    ALTER TYPE "LeaveStatus" RENAME VALUE 'EN_ATTENTE_DRH' TO 'EN_ATTENTE_DG';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'LeaveStatus' AND e.enumlabel = 'APPROUVE') THEN
    ALTER TYPE "LeaveStatus" RENAME VALUE 'APPROUVE' TO 'AUTORISE';
  END IF;
END $$;

ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'EN_ATTENTE_CHEF';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'EN_ATTENTE_DOYEN';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'EN_ATTENTE_DG';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'AUTORISE';

-- 3) Énums de la chaîne de validation (idempotent)
DO $$ BEGIN
  CREATE TYPE "LeaveApprovalLevel" AS ENUM ('CHEF', 'DOYEN', 'DG_RECTEUR');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "LeaveDecision" AS ENUM ('FAVORABLE', 'DEFAVORABLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4) Table de traçabilité (idempotent)
CREATE TABLE IF NOT EXISTS "LeaveApproval" (
    "id" TEXT NOT NULL,
    "level" "LeaveApprovalLevel" NOT NULL,
    "decision" "LeaveDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "decidedById" TEXT,
    CONSTRAINT "LeaveApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeaveApproval_requestId_idx" ON "LeaveApproval"("requestId");

DO $$ BEGIN
  ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
