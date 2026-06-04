import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Agent, Contract, Service } from "@prisma/client";
import { CONTRACT_TYPE_LABEL, formatDate } from "@/lib/contract-utils";

const FONT = "Calibri";

type AgentLite = Pick<
  Agent,
  "firstName" | "lastName" | "gender" | "address" | "matricule" | "jobTitle" | "hireDate"
>;
type ContractLite = Pick<Contract, "reference" | "type">;
type ServiceLite = Pick<Service, "name">;

function p(opts: {
  text: string;
  bold?: boolean;
  size?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  spacingAfter?: number;
}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    heading: opts.heading,
    spacing: { after: opts.spacingAfter ?? 160 },
    children: [
      new TextRun({
        text: opts.text,
        bold: opts.bold,
        size: opts.size ?? 22,
        font: FONT,
      }),
    ],
  });
}

export async function buildResignationLetterDocx(
  agent: AgentLite,
  contract: ContractLite,
  service: ServiceLite,
  details: {
    effectiveDate: Date;
    noticeStartDate?: Date | null;
    reason?: string | null;
  },
): Promise<Uint8Array<ArrayBuffer>> {
  const civ = agent.gender === "FEMME" ? "Madame" : "Monsieur";
  const today = formatDate(new Date());
  const noticeStart = details.noticeStartDate ?? new Date();

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: `Lettre de démission — ${agent.firstName} ${agent.lastName}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } },
        },
        children: [
          // Expéditeur (agent)
          p({
            text: `${agent.firstName} ${agent.lastName.toUpperCase()}`,
            bold: true,
          }),
          p({ text: `Matricule : ${agent.matricule}`, spacingAfter: 80 }),
          agent.address
            ? p({ text: agent.address, spacingAfter: 240 })
            : p({ text: "", spacingAfter: 100 }),

          // Destinataire
          p({ text: "À l'attention de", spacingAfter: 40 }),
          p({ text: "Monsieur le Directeur des Ressources Humaines", bold: true }),
          p({
            text: "Université St Christopher — Dakar",
            spacingAfter: 280,
          }),

          // Date et lieu
          p({ text: `Dakar, le ${today}`, align: AlignmentType.RIGHT, spacingAfter: 300 }),

          // Objet
          p({
            text: "Objet : Lettre de démission",
            bold: true,
            heading: HeadingLevel.HEADING_3,
            spacingAfter: 240,
          }),

          p({ text: `${civ} le Directeur,`, spacingAfter: 240 }),

          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  `Par la présente, j'ai l'honneur de vous notifier ma décision de mettre un terme à mon contrat ` +
                  `(référence ${contract.reference}, type ${CONTRACT_TYPE_LABEL[contract.type]}) ` +
                  `en qualité de ${agent.jobTitle} au sein du service ${service.name}, ` +
                  `que j'occupe depuis le ${formatDate(agent.hireDate)}.`,
                size: 22,
                font: FONT,
              }),
            ],
          }),

          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  `Conformément aux dispositions contractuelles et au code du travail sénégalais, ` +
                  `mon préavis débute le ${formatDate(noticeStart)} et prendra fin le ${formatDate(details.effectiveDate)}, ` +
                  `date à laquelle ma démission prendra effet définitivement.`,
                size: 22,
                font: FONT,
              }),
            ],
          }),

          details.reason
            ? new Paragraph({
                spacing: { after: 200 },
                alignment: AlignmentType.JUSTIFIED,
                children: [
                  new TextRun({
                    text: `Motif de cette décision : ${details.reason}`,
                    size: 22,
                    font: FONT,
                  }),
                ],
              })
            : new Paragraph({ children: [], spacing: { after: 0 } }),

          new Paragraph({
            spacing: { after: 240 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  "Je m'engage à assurer la bonne continuité de mes missions durant la période de préavis " +
                  "et à procéder à toute transmission utile à mon ou ma successeur·e.",
                size: 22,
                font: FONT,
              }),
            ],
          }),

          new Paragraph({
            spacing: { after: 300 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `Veuillez agréer, ${civ} le Directeur, l'expression de mes salutations distinguées.`,
                size: 22,
                font: FONT,
              }),
            ],
          }),

          p({
            text: `${agent.firstName} ${agent.lastName.toUpperCase()}`,
            bold: true,
            align: AlignmentType.RIGHT,
            spacingAfter: 80,
          }),
          p({
            text: "(Signature précédée de la mention « Lu et approuvé »)",
            size: 20,
            align: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice() as Uint8Array<ArrayBuffer>;
}
