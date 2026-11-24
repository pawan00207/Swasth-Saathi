function sanitizePdfText(input) {
  return String(input ?? "")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLines(text, maxChars = 78) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return ["-"];
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current.length + 1 + word.length) <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildReportPdfBuffer(report) {
  const rows = [
    { text: "SWASTH SAATHI - VERIFIED MEDICAL REPORT", size: 16, bold: true, gap: 26 },
    { text: "ABDM & Care Vault Digital Clinical Summary", size: 10, bold: false, gap: 24 },
    { text: "--------------------------------------------------------------------------------", size: 10, bold: false, gap: 18 },
    { text: `Record ID: ${report.id || "REC-SWASTH"}`, size: 11, bold: true, gap: 18 },
    { text: `Patient Name: ${report.patientName || "Not specified"}`, size: 11, bold: false, gap: 18 },
    { text: `Patient / ABHA ID: ${report.patientId || "ABHA Linked"}`, size: 11, bold: false, gap: 18 },
    { text: `Report Type: ${report.reportType || "Clinical Report"}`, size: 11, bold: false, gap: 18 },
    { text: `Report Date: ${report.reportDate || new Date().toISOString().slice(0, 10)}`, size: 11, bold: false, gap: 18 },
    { text: `Attending Doctor: ${report.doctor || "Verified Clinician"}`, size: 11, bold: false, gap: 22 },
    { text: "Clinical Summary & Findings:", size: 12, bold: true, gap: 18 },
  ];

  const summaryText = report.notes || report.extractedText || "Verified clinical record stored in Swasth Saathi Care Vault.";
  for (const line of wrapLines(summaryText, 76)) {
    rows.push({ text: line, size: 11, bold: false, gap: 16 });
  }

  rows.push({ text: " ", size: 10, bold: false, gap: 14 });
  rows.push({ text: "--------------------------------------------------------------------------------", size: 10, bold: false, gap: 16 });
  rows.push({ text: `Generated At: ${new Date().toISOString()}`, size: 9, bold: false, gap: 14 });
  rows.push({ text: "Swasth Saathi Care Portal - Not a substitute for professional medical advice.", size: 9, bold: false, gap: 14 });

  let stream = "BT\n";
  let y = 760;
  for (const row of rows) {
    if (y < 60) break;
    const font = row.bold ? "/F2" : "/F1";
    stream += `${font} ${row.size} Tf\n1 0 0 1 48 ${y} Tm\n(${sanitizePdfText(row.text)}) Tj\n`;
    y -= row.gap;
  }
  stream += "ET\n";

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}
