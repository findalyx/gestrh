-- Nouveau type de courrier contractuel : demande d'explication.
ALTER TYPE "ContractNotificationKind"
  ADD VALUE IF NOT EXISTS 'DEMANDE_EXPLICATION';
