-- Un agent peut diriger plusieurs services : on retire l'unicité sur
-- Service.managerId et on la remplace par un simple index.
DROP INDEX IF EXISTS "Service_managerId_key";
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "Service_managerId_key";
CREATE INDEX IF NOT EXISTS "Service_managerId_idx" ON "Service"("managerId");
