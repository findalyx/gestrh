-- Les permanents (ex-prestataires) sont désormais comptés parmi les CDI :
-- leurs contrats de prestation deviennent des CDI. La catégorie PRESTATAIRE
-- (affichée « Permanent ») reste inchangée.
UPDATE "Contract"
SET type = 'CDI', "updatedAt" = NOW()
WHERE type = 'PRESTATION';
