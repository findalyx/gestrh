import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  ContractNotificationKind,
  type Agent,
  type Contract,
  type Service,
} from "@prisma/client";
import { formatDate } from "@/lib/contract-utils";

const FONT = "Calibri";

type AgentLite = Pick<
  Agent,
  "firstName" | "lastName" | "gender" | "address" | "matricule" | "jobTitle"
>;
type ContractLite = Pick<Contract, "reference" | "type" | "endDate" | "startDate">;
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
    spacing: { after: opts.spacingAfter ?? 120 },
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

const SUBJECT_BY_KIND: Record<ContractNotificationKind, string> = {
  RENOUVELLEMENT: "Notification de renouvellement de contrat",
  NON_RENOUVELLEMENT: "Notification de non-renouvellement de contrat",
  FIN_PERIODE_ESSAI: "Notification de fin de période d'essai",
  CONFIRMATION_PERIODE_ESSAI: "Confirmation de période d'essai",
  RUPTURE_ANTICIPEE: "Notification de rupture anticipée du contrat",
};

function buildBodyLines(
  kind: ContractNotificationKind,
  agent: AgentLite,
  contract: ContractLite,
  service: ServiceLite,
  decisionDetails: { newEndDate?: Date | null; reason?: string | null },
): string[] {
  const civ = agent.gender === "FEMME" ? "Madame" : "Monsieur";
  const lines: string[] = [`${civ},`];

  switch (kind) {
    case "RENOUVELLEMENT":
      lines.push(
        `Nous avons le plaisir de vous informer du renouvellement de votre contrat de travail ` +
          `(référence ${contract.reference}) en qualité de ${agent.jobTitle} au sein du service ${service.name}.`,
        decisionDetails.newEndDate
          ? `Le présent renouvellement court jusqu'au ${formatDate(decisionDetails.newEndDate)}.`
          : "Les modalités et la durée du renouvellement vous seront précisées par avenant joint à la présente.",
        "L'ensemble des autres clauses contractuelles demeure inchangé, sauf modifications explicitement notifiées par avenant.",
      );
      break;
    case "NON_RENOUVELLEMENT":
      lines.push(
        `Nous vous informons par la présente que votre contrat de travail à durée déterminée ` +
          `(référence ${contract.reference}) ne sera pas renouvelé à son échéance.`,
        contract.endDate
          ? `Votre dernier jour effectif de travail correspondra au ${formatDate(contract.endDate)}, terme prévu de votre contrat.`
          : "Votre dernier jour effectif sera précisé conformément aux dispositions de votre contrat.",
        "Nous vous remercions sincèrement pour votre engagement et votre contribution au sein de l'Université St Christopher.",
      );
      break;
    case "CONFIRMATION_PERIODE_ESSAI":
      lines.push(
        `À l'issue de votre période d'essai, nous avons le plaisir de vous confirmer dans vos fonctions ` +
          `de ${agent.jobTitle} au sein du service ${service.name}.`,
        "Votre contrat se poursuit ainsi aux conditions initialement convenues.",
      );
      break;
    case "FIN_PERIODE_ESSAI":
      lines.push(
        `Nous vous notifions la fin de votre période d'essai dans le cadre du contrat ${contract.reference}.`,
        "Conformément aux dispositions légales et contractuelles, votre relation de travail prend fin à la date indiquée ci-dessus.",
      );
      break;
    case "RUPTURE_ANTICIPEE":
      lines.push(
        `Nous vous notifions, par la présente, la rupture anticipée de votre contrat de travail ` +
          `(référence ${contract.reference}).`,
        "Les motifs et modalités de cette rupture vous sont exposés ci-après et seront détaillés lors de l'entretien prévu à cet effet.",
      );
      break;
  }

  if (decisionDetails.reason) {
    lines.push(`Motif de la décision : ${decisionDetails.reason}`);
  }
  lines.push(
    "Nous vous prions d'accuser réception de la présente notification et restons à votre disposition pour toute précision.",
    `Veuillez agréer, ${civ}, l'expression de nos salutations distinguées.`,
  );
  return lines;
}

function bodyParagraphs(lines: string[]): Paragraph[] {
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 160 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: line, size: 22, font: FONT })],
      }),
  );
}

export async function buildNotificationDocx(
  kind: ContractNotificationKind,
  agent: AgentLite,
  contract: ContractLite,
  service: ServiceLite,
  decisionDetails: { newEndDate?: Date | null; reason?: string | null } = {},
): Promise<{ bytes: Uint8Array<ArrayBuffer>; subject: string; body: string }> {
  const subject = SUBJECT_BY_KIND[kind];
  const today = formatDate(new Date());
  const lines = buildBodyLines(kind, agent, contract, service, decisionDetails);

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: subject,
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
          p({ text: `Dakar, le ${today}`, align: AlignmentType.RIGHT, spacingAfter: 300 }),
          p({
            text: `À l'attention de ${agent.gender === "FEMME" ? "Madame" : "Monsieur"} ${agent.firstName} ${agent.lastName.toUpperCase()}`,
            bold: true,
          }),
          p({ text: `Matricule : ${agent.matricule}`, spacingAfter: 80 }),
          agent.address
            ? p({ text: agent.address, spacingAfter: 300 })
            : p({ text: "", spacingAfter: 100 }),
          p({
            text: `Objet : ${subject}`,
            bold: true,
            heading: HeadingLevel.HEADING_3,
            spacingAfter: 240,
          }),
          ...bodyParagraphs(lines),
          p({ text: "", spacingAfter: 300 }),
          p({
            text: "Pour la Direction des Ressources Humaines,",
            bold: true,
            align: AlignmentType.RIGHT,
            spacingAfter: 300,
          }),
          p({
            text: "(Nom, qualité et signature)",
            size: 20,
            align: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength,
  ).slice() as Uint8Array<ArrayBuffer>;

  return { bytes, subject, body: lines.join("\n\n") };
}
