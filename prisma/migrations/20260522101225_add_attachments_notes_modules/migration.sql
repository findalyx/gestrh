-- AlterTable : on remplit avec publishedAt pour les lignes existantes
ALTER TABLE "Announcement" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Announcement" SET "updatedAt" = "publishedAt";

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN     "durationHours" INTEGER,
ADD COLUMN     "instructor" TEXT,
ADD COLUMN     "objectives" TEXT;

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "stage" "ApplicationStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationHours" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAttachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "announcementId" TEXT NOT NULL,

    CONSTRAINT "AnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_order_idx" ON "CourseModule"("courseId", "order");

-- CreateIndex
CREATE INDEX "AnnouncementAttachment_announcementId_idx" ON "AnnouncementAttachment"("announcementId");

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAttachment" ADD CONSTRAINT "AnnouncementAttachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
