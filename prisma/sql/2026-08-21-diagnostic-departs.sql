-- ============================================================
--  Diagnostic : pourquoi le compteur « Départs » du tableau de bord
--  est inférieur au nombre de personnes dans la vue « Personnes parties » ?
--
--  Le compteur ne retient que les départs DATÉS DANS L'ANNÉE EN COURS ;
--  la liste, elle, montre toute personne au statut Inactif ou Retraité,
--  quelle que soit la date (ou même sans date).
--  Lecture seule — aucune modification.
-- ============================================================
SELECT
  a.matricule,
  a."lastName",
  a."firstName",
  a.status,
  a."departureDate",
  a."departureReason",
  CASE
    WHEN a."departureDate" IS NULL THEN 'EXCLU — aucune date de départ'
    WHEN a."departureDate" < date_trunc('year', CURRENT_DATE) THEN 'EXCLU — départ d''une année antérieure'
    WHEN a."departureDate" > CURRENT_DATE THEN 'EXCLU — date de départ dans le futur'
    ELSE 'compté dans les départs de l''année'
  END AS diagnostic
FROM "Agent" a
WHERE a.status IN ('INACTIF', 'RETRAITE')
ORDER BY a."departureDate" NULLS FIRST, a."lastName";
