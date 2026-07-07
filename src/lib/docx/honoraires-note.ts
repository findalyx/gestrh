import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { numberToWordsFr } from "@/lib/number-to-words";
import { applyLetterhead } from "./letterhead";

const FONT = "Calibri";

export type HonorairesDocxArgs = {
  organization: {
    name: string;
    shortName: string | null;
    city: string | null;
    bp: string | null;
    address: string | null;
  };
  beneficiary: {
    civility: string; // "Monsieur" / "Madame"
    fullName: string; // "NDAO YOUSSOU"
  };
  note: {
    reference: string;
    date: Date;
    designation: string;
    grossAmount: number;
    withholding: number;
    netAmount: number;
  };
};

/** « 1 578 947 » avec espaces ASCII. */
function money(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" })
    .format(d)
    .replace(/[  ]/g, " ");
}

function run(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size ?? 22,
    font: FONT,
  });
}

function p(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120 },
    children: [run(text, { bold: opts.bold, size: opts.size })],
  });
}

/** Cellule de tableau avec texte. */
function cell(
  text: string,
  opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; width?: number } = {},
): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { after: 20, before: 20 },
        children: [run(text, { bold: opts.bold, size: 20 })],
      }),
    ],
  });
}

export async function buildHonorairesNoteDocx(
  args: HonorairesDocxArgs,
): Promise<Uint8Array<ArrayBuffer>> {
  const emitter = args.organization.shortName || args.organization.name;
  const children: (Paragraph | Table)[] = [];

  // ── En-tête droite : date + coordonnées ───────────────────────
  children.push(
    p(`Dakar, le ${formatDateFr(args.note.date)}`, {
      align: AlignmentType.RIGHT,
      after: 40,
    }),
  );
  children.push(
    p(emitter.toUpperCase(), { align: AlignmentType.RIGHT, bold: true, after: 20 }),
  );
  if (args.organization.bp) {
    children.push(
      p(`BP ${args.organization.bp}${args.organization.city ? ` - ${args.organization.city}` : ""}`, {
        align: AlignmentType.RIGHT,
        size: 20,
        after: 240,
      }),
    );
  }

  // ── Bénéficiaire ──────────────────────────────────────────────
  children.push(
    p(`${args.beneficiary.civility} ${args.beneficiary.fullName}`, {
      bold: true,
      size: 24,
      after: 40,
    }),
  );
  children.push(p(args.note.designation, { size: 22, after: 260 }));

  // ── Titre ─────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 240 },
      children: [
        run(`NOTE D'HONORAIRES N° ${args.note.reference}`, { bold: true, size: 26 }),
      ],
    }),
  );

  // ── Tableau désignation ───────────────────────────────────────
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("N°", { bold: true, align: AlignmentType.CENTER, width: 8 }),
      cell("Désignation de l'intervention", { bold: true, width: 52 }),
      cell("Date", { bold: true, align: AlignmentType.CENTER, width: 16 }),
      cell("Forfait", { bold: true, align: AlignmentType.RIGHT, width: 12 }),
      cell("Total", { bold: true, align: AlignmentType.RIGHT, width: 12 }),
    ],
  });
  const dataRow = new TableRow({
    children: [
      cell("1", { align: AlignmentType.CENTER }),
      cell(args.note.designation),
      cell(formatDateFr(args.note.date), { align: AlignmentType.CENTER }),
      cell(money(args.note.grossAmount), { align: AlignmentType.RIGHT }),
      cell(money(args.note.grossAmount), { align: AlignmentType.RIGHT }),
    ],
  });
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, dataRow],
    }),
  );

  children.push(p("", { after: 200 }));

  // ── Totaux (alignés à droite) ─────────────────────────────────
  const totalLine = (label: string, value: number, bold = false) =>
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [run(`${label}  ${money(value)} FCFA`, { bold, size: 22 })],
    });
  children.push(totalLine("Total Honoraires Brut :", args.note.grossAmount));
  children.push(totalLine("Retenue à la source 5% :", args.note.withholding));
  children.push(
    totalLine("Total Net des Honoraires de la Période :", args.note.netAmount, true),
  );
  children.push(p("", { after: 120 }));

  // ── Montant arrêté + en lettres ───────────────────────────────
  children.push(
    p(
      `Présente note d'honoraires arrêtée à la somme de : ${money(args.note.netAmount)} FCFA`,
      { size: 22, after: 40 },
    ),
  );
  const words = `${numberToWordsFr(args.note.netAmount)} francs CFA`;
  children.push(
    p(words.charAt(0).toUpperCase() + words.slice(1), {
      bold: true,
      size: 22,
      after: 360,
    }),
  );

  // ── Visa + signature ──────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      tabStops: [{ type: "right", position: 9000 }],
      children: [
        run("Visa Contrôle SCIMD", { bold: true }),
        new TextRun({ text: "\tSignature", bold: true, size: 22, font: FONT }),
      ],
    }),
  );
  children.push(
    p(`${args.beneficiary.civility} ${args.beneficiary.fullName}`, {
      align: AlignmentType.RIGHT,
      size: 20,
      after: 0,
    }),
  );

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: `Note d'honoraires ${args.note.reference}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 },
          },
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice();
  // Greffe sur le papier en-tête officiel s'il est configuré.
  return applyLetterhead(bytes);
}
