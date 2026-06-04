import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  AmendmentType,
  type Agent,
  type Contract,
  type ContractAmendment,
  type Service,
} from "@prisma/client";
import { CONTRACT_TYPE_LABEL, formatDate } from "@/lib/contract-utils";

const FONT = "Calibri";

const TYPE_LABEL: Record<AmendmentType, string> = {
  SALAIRE: "modification du salaire",
  GRADE: "modification du grade",
  FONCTION: "modification des fonctions",
  HORAIRES: "modification des horaires",
  MUTATION: "mutation",
  AUTRE: "modification contractuelle",
};

type AgentLite = Pick<
  Agent,
  "firstName" | "lastName" | "gender" | "matricule" | "jobTitle"
>;
type ContractLite = Pick<Contract, "reference" | "type" | "startDate">;
type ServiceLite = Pick<Service, "name">;
type AmendmentLite = Pick<
  ContractAmendment,
  "reference" | "type" | "effectiveDate" | "description" | "oldValue" | "newValue"
>;

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

export async function buildAmendmentDocx(
  amendment: AmendmentLite,
  contract: ContractLite,
  agent: AgentLite,
  service: ServiceLite,
): Promise<Uint8Array<ArrayBuffer>> {
  const civ = agent.gender === "FEMME" ? "Madame" : "Monsieur";

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: `Avenant ${amendment.reference}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
        children: [
          p({
            text: "UNIVERSITÉ ST CHRISTOPHER — DAKAR",
            bold: true,
            size: 28,
            align: AlignmentType.CENTER,
          }),
          p({
            text: "Direction des Ressources Humaines",
            size: 22,
            align: AlignmentType.CENTER,
            spacingAfter: 300,
          }),
          p({
            text: `AVENANT ${amendment.reference}`,
            bold: true,
            size: 32,
            heading: HeadingLevel.HEADING_1,
            align: AlignmentType.CENTER,
            spacingAfter: 80,
          }),
          p({
            text: `au contrat ${CONTRACT_TYPE_LABEL[contract.type]} ${contract.reference}`,
            size: 22,
            align: AlignmentType.CENTER,
            spacingAfter: 300,
          }),

          p({ text: "ENTRE LES SOUSSIGNÉS :", bold: true, spacingAfter: 100 }),
          p({
            text: "L'Université St Christopher, représentée par son Directeur Général,",
          }),
          p({ text: "Ci-après dénommée « l'Employeur »,", spacingAfter: 160 }),
          p({ text: "ET", bold: true, align: AlignmentType.CENTER, spacingAfter: 120 }),
          p({
            text: `${civ} ${agent.firstName} ${agent.lastName.toUpperCase()} (matricule ${agent.matricule}),`,
            bold: true,
          }),
          p({
            text: `actuellement ${agent.jobTitle} au sein du service ${service.name},`,
          }),
          p({ text: "Ci-après dénommé(e) « l'Agent »,", spacingAfter: 240 }),

          p({ text: "IL A ÉTÉ CONVENU CE QUI SUIT :", bold: true, spacingAfter: 200 }),

          p({
            text: "Article 1 — Objet de l'avenant",
            bold: true,
            size: 24,
            spacingAfter: 120,
          }),
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  `Le présent avenant a pour objet la ${TYPE_LABEL[amendment.type]} ` +
                  `du contrat de travail conclu le ${formatDate(contract.startDate)}.`,
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
                text: amendment.description,
                size: 22,
                font: FONT,
              }),
            ],
          }),

          ...(amendment.oldValue || amendment.newValue
            ? [
                p({
                  text: "Article 2 — Modification opérée",
                  bold: true,
                  size: 24,
                  spacingAfter: 120,
                }),
                p({
                  text: `Avant : ${amendment.oldValue ?? "—"}`,
                  spacingAfter: 80,
                }),
                p({
                  text: `Après : ${amendment.newValue ?? "—"}`,
                  spacingAfter: 200,
                }),
              ]
            : []),

          p({
            text: "Article 3 — Date d'effet",
            bold: true,
            size: 24,
            spacingAfter: 120,
          }),
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text:
                  `Le présent avenant prend effet le ${formatDate(amendment.effectiveDate)}. ` +
                  "L'ensemble des autres clauses du contrat initial demeure inchangé.",
                size: 22,
                font: FONT,
              }),
            ],
          }),

          p({ text: "", spacingAfter: 400 }),
          p({ text: "Fait à Dakar, le ……………………………………", spacingAfter: 300 }),
          p({
            text: "Pour l'Université                                              L'Agent",
            bold: true,
            spacingAfter: 80,
          }),
          p({
            text: "(Nom, qualité et signature)                       (Signature précédée de « Lu et approuvé »)",
            size: 20,
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice() as Uint8Array<ArrayBuffer>;
}
