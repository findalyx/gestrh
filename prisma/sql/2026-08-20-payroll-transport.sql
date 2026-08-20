-- Indemnité de transport lue sur le bulletin : elle s'ajoute au coût supporté
-- par l'employeur (elle n'est pas comprise dans le total brut imposable).
ALTER TABLE "PayrollRecord"
  ADD COLUMN IF NOT EXISTS "transport" INTEGER NOT NULL DEFAULT 0;
