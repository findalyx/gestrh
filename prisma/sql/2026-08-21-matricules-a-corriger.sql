-- ============================================================
--  Matricules erronés : alignement sur le logiciel de paie
--  (audit des bulletins janvier → mai 2026)
--
--  Ces trois agents existent bien dans le SIRH mais sous un matricule généré
--  automatiquement, différent de celui du bulletin. Comme l'import de la paie
--  rapproche les bulletins PAR MATRICULE, leurs bulletins ressortaient
--  « non reliés à un agent ».
--
--  À ne lancer qu'après avoir confirmé que le matricule du bulletin fait foi.
--  Script IDEMPOTENT : sans effet si la correction est déjà faite.
-- ============================================================

-- MBODJ Mbaye Dieng — Assistant IT, embauché le 02/01/2021
UPDATE "Agent" SET matricule = '3110', "updatedAt" = NOW()
WHERE matricule = '3107'
  AND "lastName" ILIKE 'MBODJ'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3110');

-- SANE Ndeye Khady — Aide au fauteuil dentaire, embauchée le 24/10/2024
UPDATE "Agent" SET matricule = '3134', "updatedAt" = NOW()
WHERE matricule = '3120-2'
  AND "lastName" ILIKE 'SANE'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3134');

-- BEN NACEUR Mohamed Ali — Directeur Général, embauché le 01/05/2024
UPDATE "Agent" SET matricule = '3137', "updatedAt" = NOW()
WHERE matricule = '3135'
  AND "lastName" ILIKE 'BEN NACEUR'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3137');

-- Contrôle : les trois matricules doivent désormais exister.
SELECT matricule, "lastName", "firstName", "jobTitle"
FROM "Agent"
WHERE matricule IN ('3110', '3134', '3137')
ORDER BY matricule;
