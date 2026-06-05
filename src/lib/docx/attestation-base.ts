import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/**
 * Socle commun aux attestations signées par le Doyen Exécutif (pour le
 * Directeur Général), calé sur les modèles fournis par l'organisation
 * (attestation de congés / de reprise / de travail).
 */

export const FONT = "Calibri";

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function para(opts: {
  text: string;
  bold?: boolean;
  italics?: boolean;
  size?: number;
  align?: Align;
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
        italics: opts.italics,
        size: opts.size ?? 24,
        font: FONT,
      }),
    ],
  });
}

export type AttestationOptions = {
  /** En-tête en haut à gauche (ex. « LE DIRECTEUR GENERAL »). */
  topLeft: string;
  /** Lignes optionnelles en haut à droite (ex. date + référence). */
  topRightLines?: string[];
  /** Titre centré (ex. « Attestation de Congés »). */
  title: string;
  /** Paragraphes du corps (texte justifié). */
  bodyParas: string[];
  /** Phrase de clôture (ex. « Attestation faite pour servir… »). */
  closing?: string;
  /** Ligne lieu + date (ex. « Fait à Dakar, le … »). */
  placeDateLine?: string;
  /** Lignes de signature, alignées à droite. */
  signatureLines: string[];
  /** Métadonnée titre du document. */
  docTitle: string;
};

export async function buildAttestationDocx(
  opts: AttestationOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const children: Paragraph[] = [];

  // En-tête : « LE DIRECTEUR GENERAL » à gauche, lignes optionnelles à droite.
  children.push(
    para({ text: opts.topLeft, bold: true, size: 24, spacingAfter: 60 }),
  );
  for (const line of opts.topRightLines ?? []) {
    children.push(
      para({
        text: line,
        align: AlignmentType.RIGHT,
        size: 22,
        spacingAfter: 60,
      }),
    );
  }

  // Titre
  children.push(
    para({
      text: opts.title,
      bold: true,
      size: 30,
      heading: HeadingLevel.HEADING_1,
      align: AlignmentType.CENTER,
      spacingAfter: 360,
    }),
  );

  // Corps
  for (const b of opts.bodyParas) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 220 },
        children: [new TextRun({ text: b, size: 24, font: FONT })],
      }),
    );
  }

  // Clôture
  if (opts.closing) {
    children.push(
      para({ text: opts.closing, spacingAfter: 280, italics: false }),
    );
  }

  // Lieu + date
  if (opts.placeDateLine) {
    children.push(
      para({
        text: opts.placeDateLine,
        align: AlignmentType.RIGHT,
        spacingAfter: 280,
      }),
    );
  }

  // Signatures (droite)
  opts.signatureLines.forEach((line, i) => {
    children.push(
      para({
        text: line,
        bold: i === opts.signatureLines.length - 1,
        align: AlignmentType.RIGHT,
        spacingAfter: i === opts.signatureLines.length - 1 ? 200 : 120,
      }),
    );
  });

  const doc = new Document({
    creator: "SIRH St Christopher",
    title: opts.docTitle,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 } },
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength,
  ).slice() as Uint8Array<ArrayBuffer>;
}

/** Civilité longue selon le genre. */
export function civilite(gender: "HOMME" | "FEMME" | string): {
  long: string; // Madame / Monsieur
  court: string; // Mme / M.
  ne: string; // é / ée
  ielle: string; // Il / Elle
} {
  const femme = gender === "FEMME";
  return {
    long: femme ? "Madame" : "Monsieur",
    court: femme ? "Mme" : "M.",
    ne: femme ? "ée" : "é",
    ielle: femme ? "Elle" : "Il",
  };
}
