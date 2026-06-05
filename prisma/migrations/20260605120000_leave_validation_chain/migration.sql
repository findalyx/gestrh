-- ============================================================
--  Congés — chaîne de validation Université St Christopher
--  Employé -> Chef de Service -> Doyen -> DG/Recteur -> Autorisé
-- ============================================================

-- 1) Nouveaux rôles
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RECTEUR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOYEN';

-- 2) Statuts congés : on renomme les statuts existants vers la nouvelle
--    chaîne (les lignes existantes suivent automatiquement le renommage)
--    et on ajoute le nouveau niveau Doyen.
ALTER TYPE "LeaveStatus" RENAME VALUE 'EN_ATTENTE_MANAGER' TO 'EN_ATTENTE_CHEF';
ALTER TYPE "LeaveStatus" RENAME VALUE 'EN_ATTENTE_DRH' TO 'EN_ATTENTE_DG';
ALTER TYPE "LeaveStatus" RENAME VALUE 'APPROUVE' TO 'AUTORISE';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'EN_ATTENTE_DOYEN';

-- 3) Énums de la chaîne de validation
CREATE TYPE "LeaveApprovalLevel" AS ENUM ('CHEF', 'DOYEN', 'DG_RECTEUR');
CREATE TYPE "LeaveDecision" AS ENUM ('FAVORABLE', 'DEFAVORABLE');

-- 4) Table de traçabilité (une ligne par décision)
CREATE TABLE "LeaveApproval" (
    "id" TEXT NOT NULL,
    "level" "LeaveApprovalLevel" NOT NULL,
    "decision" "LeaveDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "decidedById" TEXT,
    CONSTRAINT "LeaveApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveApproval_requestId_idx" ON "LeaveApproval"("requestId");

ALTER TABLE "LeaveApproval"
  ADD CONSTRAINT "LeaveApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeaveApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
