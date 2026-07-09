"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteAttachment } from "../_lib/actions";

export function DeleteAttachmentButton({ id }: { id: string }) {
  return (
    <ConfirmSubmitButton
      action={deleteAttachment.bind(null, id) as never}
      title="Retirer la pièce jointe"
      confirmText="Retirer ce fichier ?"
      confirmLabel="Retirer"
    />
  );
}
