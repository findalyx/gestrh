-- Ciblage des annonces : catégories de personnel et/ou services destinataires.
-- Listes vides = annonce visible par tout le personnel (comportement actuel).
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "categories" "StaffCategory"[] NOT NULL DEFAULT '{}';
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "serviceIds" TEXT[] NOT NULL DEFAULT '{}';
