-- ============================================================
--  Migration : Workflow contrats — avenants, renouvellements,
--  démissions, notifications. Transposé depuis segnoogo/gestRH,
--  adapté au stockage Supabase (fichiers hors base : on ne garde
--  que fileName/mimeType/size ; les octets vivent dans le bucket).
-- ============================================================

-- 1) Nouvelles valeurs d'énums existants
ALTER TYPE "ContractStatus" ADD VALUE 'EN_ATTENTE_SIGNATURE';
ALTER TYPE "ContractStatus" ADD VALUE 'ROMPU';

ALTER TYPE "DocumentType" ADD VALUE 'CONTRAT_SIGNE';
ALTER TYPE "DocumentType" ADD VALUE 'AVENANT';
ALTER TYPE "DocumentType" ADD VALUE 'AVENANT_SIGNE';
ALTER TYPE "DocumentType" ADD VALUE 'DEMISSION';
ALTER TYPE "DocumentType" ADD VALUE 'NOTIFICATION_CONTRAT';
ALTER TYPE "DocumentType" ADD VALUE 'CNI';
ALTER TYPE "DocumentType" ADD VALUE 'CASIER_JUDICIAIRE';
ALTER TYPE "DocumentType" ADD VALUE 'RIB';
ALTER TYPE "DocumentType" ADD VALUE 'PHOTO';
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICAT_MEDICAL';
ALTER TYPE "DocumentType" ADD VALUE 'CV';

-- 2) Nouveaux énums
CREATE TYPE "AmendmentType" AS ENUM ('SALAIRE', 'GRADE', 'FONCTION', 'HORAIRES', 'MUTATION', 'AUTRE');
CREATE TYPE "RenewalDecision" AS ENUM ('EN_COURS', 'RENOUVELE', 'CONVERTI_CDI', 'NON_RENOUVELE');
CREATE TYPE "ResignationStatus" AS ENUM ('SOUMISE', 'ACCUSEE', 'ACCEPTEE', 'REJETEE', 'EN_PREAVIS', 'EFFECTIVE', 'ANNULEE');
CREATE TYPE "ContractNotificationKind" AS ENUM ('RENOUVELLEMENT', 'NON_RENOUVELLEMENT', 'FIN_PERIODE_ESSAI', 'RUPTURE_ANTICIPEE', 'CONFIRMATION_PERIODE_ESSAI');

-- 3) Contract : nouvelles colonnes (fichier signé hors base → pas de BYTEA)
ALTER TABLE "Contract"
  ADD COLUMN "probationEndDate" TIMESTAMP(3),
  ADD COLUMN "noticePeriodDays" INTEGER,
  ADD COLUMN "workingHours" INTEGER,
  ADD COLUMN "clauses" TEXT,
  ADD COLUMN "signedFileName" TEXT,
  ADD COLUMN "signedMimeType" TEXT,
  ADD COLUMN "signedSize" INTEGER,
  ADD COLUMN "signedAt" TIMESTAMP(3);

-- 4) Document : passage au stockage Supabase + nouveaux liens.
--    La table Document n'a pas encore d'upload réel en findalyx
--    (placeholder « ajouté dans une prochaine version »), donc on
--    purge par sécurité avant d'ajouter les colonnes NOT NULL.
DELETE FROM "Document";

ALTER TABLE "Document" DROP CONSTRAINT "Document_agentId_fkey";

ALTER TABLE "Document"
  DROP COLUMN "fileUrl",
  ADD COLUMN "fileName" TEXT NOT NULL,
  ADD COLUMN "mimeType" TEXT NOT NULL,
  ADD COLUMN "size" INTEGER NOT NULL,
  ADD COLUMN "contractId" TEXT,
  ADD COLUMN "uploadedById" TEXT;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Document_agentId_idx" ON "Document"("agentId");
CREATE INDEX "Document_contractId_idx" ON "Document"("contractId");

-- 5) ContractAmendment
CREATE TABLE "ContractAmendment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "AmendmentType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "signedFileName" TEXT,
    "signedMimeType" TEXT,
    "signedSize" INTEGER,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractId" TEXT NOT NULL,
    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractAmendment_reference_key" ON "ContractAmendment"("reference");
CREATE INDEX "ContractAmendment_contractId_idx" ON "ContractAmendment"("contractId");

ALTER TABLE "ContractAmendment"
  ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) ContractRenewal
CREATE TABLE "ContractRenewal" (
    "id" TEXT NOT NULL,
    "decision" "RenewalDecision" NOT NULL DEFAULT 'EN_COURS',
    "decidedAt" TIMESTAMP(3),
    "reason" TEXT,
    "newEndDate" TIMESTAMP(3),
    "newContractId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "decidedById" TEXT,
    CONSTRAINT "ContractRenewal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractRenewal_contractId_key" ON "ContractRenewal"("contractId");
CREATE INDEX "ContractRenewal_decision_idx" ON "ContractRenewal"("decision");

ALTER TABLE "ContractRenewal"
  ADD CONSTRAINT "ContractRenewal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractRenewal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7) Resignation
CREATE TABLE "Resignation" (
    "id" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "noticeStartDate" TIMESTAMP(3),
    "status" "ResignationStatus" NOT NULL DEFAULT 'SOUMISE',
    "reason" TEXT,
    "hrComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "signedFileName" TEXT,
    "signedMimeType" TEXT,
    "signedSize" INTEGER,
    "contractId" TEXT NOT NULL,
    "decidedById" TEXT,
    CONSTRAINT "Resignation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Resignation_contractId_key" ON "Resignation"("contractId");
CREATE INDEX "Resignation_status_idx" ON "Resignation"("status");

ALTER TABLE "Resignation"
  ADD CONSTRAINT "Resignation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Resignation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8) ContractNotification
CREATE TABLE "ContractNotification" (
    "id" TEXT NOT NULL,
    "kind" "ContractNotificationKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "contractId" TEXT NOT NULL,
    "sentById" TEXT,
    CONSTRAINT "ContractNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractNotification_contractId_idx" ON "ContractNotification"("contractId");
CREATE INDEX "ContractNotification_kind_idx" ON "ContractNotification"("kind");

ALTER TABLE "ContractNotification"
  ADD CONSTRAINT "ContractNotification_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ContractNotification_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
