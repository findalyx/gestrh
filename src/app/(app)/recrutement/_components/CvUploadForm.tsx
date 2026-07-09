"use client";

import { DirectFileUpload } from "@/components/DirectFileUpload";
import { requestCvUpload, finalizeCvUpload } from "../_lib/actions";

export function CvUploadForm({ applicationId }: { applicationId: string }) {
  return (
    <DirectFileUpload
      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
      maxMb={20}
      getUploadUrl={requestCvUpload.bind(null, applicationId)}
      finalize={(path, filename, size) =>
        finalizeCvUpload(applicationId, path, filename, size)
      }
      buttonLabel="Envoyer le CV"
    />
  );
}
