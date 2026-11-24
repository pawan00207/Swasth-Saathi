import { dhrsRequest } from "./client";

/**
 * @param {File} file
 * @returns {Promise<{extractedText:string, confidence:number}>}
 */
export async function uploadReportToOcr(file) {
  const form = new FormData();
  form.append("report", file);

  const response = await fetch("/api/dhrs/reports/ocr", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "OCR unavailable");
  }
  return data;
}
