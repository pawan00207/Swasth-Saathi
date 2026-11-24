import { jsPDF } from "jspdf";

const SCRIPT_FONTS = {
  hi: { file: "NotoSansDevanagari-Regular.ttf", family: "NotoDevanagari" },
  mr: { file: "NotoSansDevanagari-Regular.ttf", family: "NotoDevanagari" },
  bn: { file: "NotoSansBengali-Regular.ttf", family: "NotoBengali" },
  ta: { file: "NotoSansTamil-Regular.ttf", family: "NotoTamil" },
  te: { file: "NotoSansTelugu-Regular.ttf", family: "NotoTelugu" },
  gu: { file: "NotoSansGujarati-Regular.ttf", family: "NotoGujarati" },
  pa: { file: "NotoSansGurmukhi-Regular.ttf", family: "NotoGurmukhi" },
  en: { file: "NotoSansDevanagari-Regular.ttf", family: "NotoDevanagari" },
};

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadFontIntoDoc(document, fontMeta) {
  const response = await fetch(`/fonts/${fontMeta.file}`);
  if (!response.ok) throw new Error(`The bundled font ${fontMeta.file} could not be loaded.`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  document.addFileToVFS(fontMeta.file, bytesToBase64(bytes));
  document.addFont(fontMeta.file, fontMeta.family, "normal");
  return fontMeta.family;
}

async function loadScriptFont(document, locale = "en") {
  const primary = SCRIPT_FONTS[String(locale || "en").slice(0, 2)] || SCRIPT_FONTS.en;
  try {
    return await loadFontIntoDoc(document, primary);
  } catch (err) {
    if (primary.file !== SCRIPT_FONTS.en.file) {
      return loadFontIntoDoc(document, SCRIPT_FONTS.en);
    }
    throw err;
  }
}

/**
 * Generate a consistent paginated PDF using bundled Noto Sans multi-script fonts.
 * @param {{fileName:string,title:string,watermark?:string,locale?:string,returnBlob?:boolean,draw:(document:import("jspdf").jsPDF,fontFamily:string)=>void|Promise<void>}} options
 */
export async function generatePdf({ fileName, title, watermark = "SWASTH SAATHI HEALTH RECORD", locale = "en", returnBlob = false, draw }) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const fontFamily = await loadScriptFont(document, locale);

  document.setTextColor(30, 41, 59);
  await draw(document, fontFamily);

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFont(fontFamily);
    document.setFillColor(19, 78, 74);
    document.rect(0, 0, 210, 24, "F");
    document.setDrawColor(255, 255, 255);
    document.setLineWidth(0.6);
    document.circle(20, 12, 6);
    document.setTextColor(255, 255, 255);
    document.setFontSize(8);
    document.text("SS", 20, 14.5, { align: "center" });
    document.setFontSize(15);
    document.text("SWASTH SAATHI", 30, 11);
    document.setFontSize(10);
    document.text(title, 30, 18);
    document.setFontSize(8);
    document.setTextColor(100, 116, 139);
    document.text(watermark, 14, 286);
    document.text(`${page} / ${pageCount}`, 196, 286, { align: "right" });
  }
  if (returnBlob) return document.output("blob");
  document.save(fileName);
  return null;
}
