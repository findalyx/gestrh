"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteAnnouncement } from "../_lib/actions";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  return (
    <ConfirmSubmitButton
      action={deleteAnnouncement.bind(null, id) as never}
      label="Supprimer"
      confirmText="Supprimer cette annonce ?"
    />
  );
}
