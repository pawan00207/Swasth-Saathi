import { jsPDF } from "jspdf";

async function loadHindiFont(document) {
  const response = await fetch("/fonts/NotoSansDevanagari-Regular.ttf");
  if (!response.ok) throw new Error("The bundled Devanagari font could not be loaded.");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  document.addFileToVFS("NotoSansDevanagari-Regular.ttf", btoa(binary));
  document.addFont("NotoSansDevanagari-Regular.ttf", "NotoDevanagari", "normal");
}

/**
 * Generate a consistent paginated PDF using the bundled Devanagari font.
 * @param {{fileName:string,title:string,watermark?:string,returnBlob?:boolean,draw:(document:import("jspdf").jsPDF,fontFamily:string)=>void|Promise<void>}} options
 */
export async function generatePdf({ fileName, title, watermark = "DEMO PROJECT", returnBlob = false, draw }) {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  await loadHindiFont(document);
  const fontFamily = "NotoDevanagari";

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
