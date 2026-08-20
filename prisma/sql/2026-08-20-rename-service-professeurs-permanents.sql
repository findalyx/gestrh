-- Renommage du service « Prestataires Académiques » → « Professeurs permanents ».
UPDATE "Service"
SET name = 'Professeurs permanents', "updatedAt" = NOW()
WHERE name = 'Prestataires Académiques';
