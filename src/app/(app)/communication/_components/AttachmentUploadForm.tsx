"use client";

import { DirectFileUpload } from "@/components/DirectFileUpload";
import {
  requestAttachmentUpload,
  finalizeAttachmentUpload,
} from "../_lib/actions";

export function AttachmentUploadForm({
  announcementId,
}: {
  announcementId: string;
}) {
  return (
    <DirectFileUpload
      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt"
      maxMb={20}
      getUploadUrl={requestAttachmentUpload.bind(null, announcementId)}
      finalize={(path, filename, size) =>
        finalizeAttachmentUpload(announcementId, path, filename, size)
      }
      buttonLabel="Ajouter le fichier"
    />
  );
}
