-- ============================================================
--  Fiches manquantes : 4 salariés payés mais absents du SIRH
--  (audit des bulletins janvier → mai 2026)
--
--  Source : bulletins de paie SCIMD. Statut et date de départ déduits de la
--  présence mois par mois et de la ligne « Indemnité de fin de contrat ».
--  Script IDEMPOTENT : rejouable sans créer de doublon (garde sur le matricule).
--
--  ⚠ Les adresses e-mail sont des ESPACES RÉSERVÉS (le champ est obligatoire et
--    unique). À corriger sur la fiche dès que les vraies adresses sont connues.
-- ============================================================

-- 1) KOMBO-TSIMBA Jumelia — Conseillère service client
--    Bulletins de janvier à mai 2026 ; indemnité de fin de contrat en mai.
INSERT INTO "Agent" (
  id, matricule, "firstName", "lastName", email, gender, address, "maritalStatus",
  category, "subCategory", "jobTitle", status, "hireDate",
  "departureDate", "departureReason", "serviceId", "createdAt", "updatedAt"
)
SELECT
  'agt-mat-3139', '3139', 'Jumelia', 'KOMBO-TSIMBA',
  'jumelia.kombotsimba@stchris.edu', 'FEMME'::"Gender",
  'Liberté 6 N°7921 - Dakar', 'Célibataire',
  'PATS'::"StaffCategory", 'PATS_ADMINISTRATIF'::"StaffSubCategory",
  'Conseillère service client', 'INACTIF'::"AgentStatus",
  DATE '2024-11-18', DATE '2026-05-31', 'FIN_CDD'::"DepartureReason",
  s.id, NOW(), NOW()
FROM "Service" s
WHERE s.name = 'Service Marketing'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3139');

-- 2) MANAA Asma — Responsable Marketing
--    Bulletins de janvier et février 2026 ; indemnité de fin de contrat en février.
INSERT INTO "Agent" (
  id, matricule, "firstName", "lastName", email, gender, address, "maritalStatus",
  category, "subCategory", "jobTitle", status, "hireDate",
  "departureDate", "departureReason", "serviceId", "createdAt", "updatedAt"
)
SELECT
  'agt-mat-3142', '3142', 'Asma', 'MANAA',
  'asma.manaa@stchris.edu', 'FEMME'::"Gender",
  'Ngor Almadies - Dakar', 'Divorcée',
  'PATS'::"StaffCategory", 'PATS_ADMINISTRATIF'::"StaffSubCategory",
  'Responsable Marketing', 'INACTIF'::"AgentStatus",
  DATE '2025-02-21', DATE '2026-02-28', 'FIN_CDD'::"DepartureReason",
  s.id, NOW(), NOW()
FROM "Service" s
WHERE s.name = 'Service Marketing'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3142');

-- 3) DIOUF Thérèse — Téléconseillère
--    Bulletins de janvier à mars 2026, plus rien ensuite et AUCUNE indemnité de
--    fin de contrat : motif de départ à confirmer (AUTRE par défaut).
INSERT INTO "Agent" (
  id, matricule, "firstName", "lastName", email, gender, address, "maritalStatus",
  category, "subCategory", "jobTitle", status, "hireDate",
  "departureDate", "departureReason", "serviceId", "createdAt", "updatedAt"
)
SELECT
  'agt-mat-3153', '3153', 'Thérèse', 'DIOUF',
  'therese.diouf@stchris.edu', 'FEMME'::"Gender",
  'Parcelles Assainies, Unité 18 - Dakar', 'Célibataire',
  'PATS'::"StaffCategory", 'PATS_ADMINISTRATIF'::"StaffSubCategory",
  'Téléconseillère', 'INACTIF'::"AgentStatus",
  DATE '2025-07-04', DATE '2026-03-31', 'AUTRE'::"DepartureReason",
  s.id, NOW(), NOW()
FROM "Service" s
WHERE s.name = 'Service Marketing'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3153');

-- 4) DIOUF Mamadou — Conseiller commercial (TOUJOURS EN POSTE)
--    Bulletins de janvier à mai 2026, sans interruption.
INSERT INTO "Agent" (
  id, matricule, "firstName", "lastName", email, gender, address, "maritalStatus",
  category, "subCategory", "jobTitle", status, "hireDate",
  "serviceId", "createdAt", "updatedAt"
)
SELECT
  'agt-mat-3156', '3156', 'Mamadou', 'DIOUF',
  'mamadou.diouf@stchris.edu', 'HOMME'::"Gender",
  'Liberté 6 Extension - Dakar', 'Marié',
  'PATS'::"StaffCategory", 'PATS_ADMINISTRATIF'::"StaffSubCategory",
  'Conseiller commercial', 'ACTIF'::"AgentStatus",
  DATE '2025-07-07',
  s.id, NOW(), NOW()
FROM "Service" s
WHERE s.name = 'Service Marketing'
  AND NOT EXISTS (SELECT 1 FROM "Agent" a WHERE a.matricule = '3156');

-- Contrôle : les quatre fiches doivent apparaître.
SELECT matricule, "lastName", "firstName", status, "hireDate", "departureDate"
FROM "Agent"
WHERE matricule IN ('3139', '3142', '3153', '3156')
ORDER BY matricule;
