import "server-only";

import JSZip from "jszip";
import { getObject } from "@/lib/supabase-storage";

/**
 * Emplacement du papier en-tête officiel (bucket privé Supabase).
 * Préfixe dédié `templates/` — surtout PAS `branding/`, qui est purgé en
 * entier (`removePrefix`) à chaque changement de logo.
 */
export const LETTERHEAD_PATH = "templates/letterhead.docx";

export async function getLetterheadBytes(): Promise<Buffer | null> {
  return getObject(LETTERHEAD_PATH);
}

export async function hasLetterhead(): Promise<boolean> {
  return (await getLetterheadBytes()) !== null;
}

/** Extrait les paragraphes du corps d'un document.xml, hors <w:sectPr>. */
function extractBodyParagraphs(documentXml: string): string {
  const m = documentXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  if (!m) return "";
  let inner = m[1];
  const sectIdx = inner.lastIndexOf("<w:sectPr");
  if (sectIdx >= 0) inner = inner.slice(0, sectIdx);
  return inner;
}

/**
 * Greffe le corps d'un .docx généré dans le papier en-tête officiel (qui
 * apporte l'en-tête/logo et le pied de page), en conservant la mise en page de
 * section du papier en-tête. Si aucun papier en-tête n'est configuré, le
 * document généré est renvoyé tel quel.
 */
export async function applyLetterhead(
  generated: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const lhBytes = await getLetterheadBytes();
  if (!lhBytes) return generated;

  try {
    const genZip = await JSZip.loadAsync(generated);
    const genDocFile = genZip.file("word/document.xml");
    if (!genDocFile) return generated;
    const genDocXml = await genDocFile.async("string");
    const paragraphs = extractBodyParagraphs(genDocXml);
    if (!paragraphs.trim()) return generated;

    const lhZip = await JSZip.loadAsync(lhBytes);
    const lhFile = lhZip.file("word/document.xml");
    if (!lhFile) return generated;
    let lhXml = await lhFile.async("string");

    const sectIdx = lhXml.lastIndexOf("<w:sectPr");
    if (sectIdx < 0) {
      lhXml = lhXml.replace("</w:body>", `${paragraphs}</w:body>`);
    } else {
      lhXml = lhXml.slice(0, sectIdx) + paragraphs + lhXml.slice(sectIdx);
    }

    lhZip.file("word/document.xml", lhXml);
    const out = await lhZip.generateAsync({ type: "uint8array" });
    // Copie dans un Uint8Array adossé à un ArrayBuffer (compatible BodyInit).
    return new Uint8Array(out);
  } catch (e) {
    console.error("[letterhead] fusion échouée, document simple renvoyé:", e);
    return generated;
  }
}
