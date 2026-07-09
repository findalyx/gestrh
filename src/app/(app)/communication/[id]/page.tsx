import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { Icon } from "@/components/Icon";
import { AnnouncementForm } from "../_components/AnnouncementForm";
import { DeleteAnnouncementButton } from "../_components/DeleteAnnouncementButton";
import { DeleteAttachmentButton } from "../_components/DeleteAttachmentButton";
import { AttachmentUploadForm } from "../_components/AttachmentUploadForm";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

type SearchParams = { edit?: string };

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getCurrentUser();

  const ann = await prisma.announcement.findUnique({
    where: { id },
    include: {
      author: { select: { email: true, role: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ann) notFound();

  const isAuthor = ann.authorId === me.id;
  const isAdmin = me.role === Role.DIRECTION || me.role === Role.DRH;
  const canEdit = isAuthor || isAdmin;
  const isEditing = canEdit && sp.edit === "1";

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
        <Link href="/communication" className="hover:text-sc-blue">
          Communication
        </Link>
        <span>/</span>
        <span className="text-sc-blue-darker">{ann.title}</span>
      </div>

      {isEditing ? (
        <section className="rounded-xl border border-sc-border bg-white p-5 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-sc-blue-darker">
              Modifier l&apos;annonce
            </h2>
            <Link
              href={`/communication/${ann.id}`}
              className="text-[12.5px] font-medium text-sc-blue hover:underline"
            >
              ← Annuler
            </Link>
          </header>
          <AnnouncementForm
            editing={{ id: ann.id, title: ann.title, body: ann.body }}
          />

          {ann.attachments.length > 0 && (
            <div className="mt-6 border-t border-sc-border pt-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                Pièces jointes actuelles
              </h3>
              <ul className="space-y-2">
                {ann.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-sc-border bg-sc-blue-bg/40 px-3 py-2 text-[12.5px]"
                  >
                    <span>
                      {att.filename}{" "}
                      <span className="text-[11px] text-gray-500">
                        ({humanFileSize(att.size)})
                      </span>
                    </span>
                    <DeleteAttachmentButton id={att.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border-t border-sc-border pt-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
              Ajouter une pièce jointe (jusqu&apos;à 20 Mo)
            </h3>
            <AttachmentUploadForm announcementId={ann.id} />
          </div>
        </section>
      ) : (
        <article className="rounded-xl border border-sc-border bg-white p-6 shadow-[0_1px_2px_rgba(51,89,164,0.06)]">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-sc-border pb-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-sc-blue-darker">
                {ann.title}
              </h1>
              <p className="mt-1 text-[12px] text-gray-500">
                Publiée le {formatDateTime(ann.publishedAt)} par{" "}
                <span className="font-mono">{ann.author.email}</span>
                <span className="ml-1 rounded-full bg-sc-blue-light px-1.5 py-[1px] text-[9.5px] font-semibold uppercase text-sc-blue">
                  {ann.author.role}
                </span>
                {ann.updatedAt.getTime() !== ann.publishedAt.getTime() && (
                  <span className="ml-2 italic text-gray-400">
                    · modifiée le {formatDateTime(ann.updatedAt)}
                  </span>
                )}
              </p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/communication/${ann.id}?edit=1`}
                  className="rounded-lg border border-sc-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-sc-blue-darker transition hover:bg-sc-blue-bg"
                >
                  Modifier
                </Link>
                <DeleteAnnouncementButton id={ann.id} />
              </div>
            )}
          </header>

          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">
            {ann.body}
          </div>

          {ann.attachments.length > 0 && (
            <div className="mt-6 border-t border-sc-border pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500">
                <Icon name="export" size={13} /> Pièces jointes (
                {ann.attachments.length})
              </h3>
              {/* Aperçu des images */}
              {ann.attachments.some((a) => a.mimeType.startsWith("image/")) && (
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ann.attachments
                    .filter((a) => a.mimeType.startsWith("image/"))
                    .map((a) => (
                      <a
                        key={a.id}
                        href={`/api/communication/attachment/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-sc-border hover:border-sc-blue"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/communication/attachment/${a.id}`}
                          alt={a.filename}
                          className="h-32 w-full object-cover"
                        />
                      </a>
                    ))}
                </div>
              )}
              {/* Liste des fichiers (tous formats) */}
              <ul className="space-y-1.5">
                {ann.attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-sc-border bg-sc-blue-bg/30 px-3 py-2 text-[12.5px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        {att.mimeType.split("/")[1]?.toUpperCase() ?? "FICHIER"}
                      </span>
                      <span className="font-medium text-sc-blue-darker">
                        {att.filename}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {humanFileSize(att.size)}
                      </span>
                    </div>
                    <a
                      href={`/api/communication/attachment/${att.id}`}
                      className="text-[11.5px] font-medium text-sc-blue hover:underline"
                    >
                      Télécharger ↓
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
