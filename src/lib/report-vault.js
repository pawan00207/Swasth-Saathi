import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const VAULT_DIR = path.resolve("/tmp/swasth-report-vault");
const SAFE_ID_PATTERN = /^[a-zA-Z0-9._-]{2,80}$/;

const HISTORICAL_REPORTS = [
  {
    id: "REC-AIIMS-2026-0412",
    patientName: "Aarav Sharma",
    patientId: "ABHA-91-4821-7703",
    reportType: "Cardiology · Lipid Profile & ECG",
    reportDate: "2026-11-22",
    doctor: "Dr. Karthik Iyer (AIIMS New Delhi)",
    notes: "Total Cholesterol: 178 mg/dL | HDL: 52 mg/dL | LDL: 102 mg/dL | Triglycerides: 118 mg/dL | ECG: Normal Sinus Rhythm 72 bpm.",
    mimeType: "application/pdf",
    fileName: "REC-AIIMS-2026-0412.pdf",
    uploadedAt: "2026-11-22T10:30:00+05:30",
  },
  {
    id: "REC-SAFD-2026-0389",
    patientName: "Aarav Sharma",
    patientId: "ABHA-91-4821-7703",
    reportType: "Radiology · Chest X-Ray (PA View)",
    reportDate: "2026-11-18",
    doctor: "Dr. Meera Sharma (Safdarjung Hospital)",
    notes: "Clear lung fields bilaterally, normal cardiomediastinal silhouette, costophrenic angles clear. No active pulmonary lesion.",
    mimeType: "application/pdf",
    fileName: "REC-SAFD-2026-0389.pdf",
    uploadedAt: "2026-11-18T14:15:00+05:30",
  },
  {
    id: "REC-PGI-2026-0314",
    patientName: "Aarav Sharma",
    patientId: "ABHA-91-4821-7703",
    reportType: "Pathology · Complete Blood Count (CBC)",
    reportDate: "2026-11-10",
    doctor: "Dr. Ananya Sen (PGIMER Chandigarh)",
    notes: "Hemoglobin: 14.1 g/dL | WBC: 6,800 /uL | Platelets: 2.45 lakh/uL | RBC: 4.82 million/uL. All hematology indices within normal limits.",
    mimeType: "application/pdf",
    fileName: "REC-PGI-2026-0314.pdf",
    uploadedAt: "2026-11-10T09:45:00+05:30",
  },
  {
    id: "KFT",
    patientName: "Aarav Sharma",
    patientId: "ABHA-91-4821-7703",
    reportType: "Pathology · Kidney Function Test (KFT)",
    reportDate: "2026-11-04",
    doctor: "Dr. Arvind Patel (Civil Hospital Ahmedabad)",
    notes: "Serum Creatinine: 0.92 mg/dL | Blood Urea: 24 mg/dL | Sodium: 139 mEq/L | Potassium: 4.3 mEq/L | eGFR > 90 mL/min.",
    mimeType: "application/pdf",
    fileName: "KFT-Report.pdf",
    uploadedAt: "2026-11-04T11:20:00+05:30",
  },
];

function getMemoryStore() {
  if (!globalThis.__swasthReportVault) {
    globalThis.__swasthReportVault = new Map();
    for (const item of HISTORICAL_REPORTS) {
      globalThis.__swasthReportVault.set(item.id, item);
    }
  }
  return globalThis.__swasthReportVault;
}

export function isValidReportId(id) {
  return typeof id === "string" && SAFE_ID_PATTERN.test(id) && !id.includes("..");
}

function resolveVaultFilePath(fileKey) {
  if (!existsSync(VAULT_DIR)) {
    mkdirSync(VAULT_DIR, { recursive: true });
  }
  const resolved = path.resolve(VAULT_DIR, fileKey);
  if (!resolved.startsWith(VAULT_DIR + path.sep)) {
    throw new Error("Invalid vault file path");
  }
  return resolved;
}

export function saveVaultReport({
  id,
  patientName,
  patientId = "",
  reportType,
  reportDate,
  doctor = "",
  notes = "",
  fileName = "",
  mimeType = "application/pdf",
  fileBuffer = null,
}) {
  if (!isValidReportId(id)) {
    throw new Error("Invalid report identifier.");
  }
  const store = getMemoryStore();
  const safeMeta = {
    id,
    patientName: String(patientName || "Patient").trim().slice(0, 120),
    patientId: String(patientId || "").trim().slice(0, 80),
    reportType: String(reportType || "Clinical Report").trim().slice(0, 80),
    reportDate: String(reportDate || new Date().toISOString().slice(0, 10)).slice(0, 20),
    doctor: String(doctor || "").trim().slice(0, 120),
    notes: String(notes || "").trim().slice(0, 2000),
    fileName: String(fileName || `${id}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120),
    mimeType: ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)
      ? mimeType
      : "application/pdf",
    uploadedAt: new Date().toISOString(),
    hasBinaryFile: Boolean(fileBuffer && fileBuffer.length > 0),
  };

  store.set(id, { ...safeMeta, fileBuffer: fileBuffer || null });

  try {
    const metaPath = resolveVaultFilePath(`${id}.json`);
    writeFileSync(metaPath, JSON.stringify(safeMeta), "utf8");
    if (fileBuffer && fileBuffer.length > 0) {
      const binPath = resolveVaultFilePath(`${id}.bin`);
      writeFileSync(binPath, fileBuffer);
    }
  } catch (err) {
    console.warn("Could not persist vault report to /tmp", err?.message || "fs warning");
  }

  return safeMeta;
}

export function getVaultReport(id) {
  if (!isValidReportId(id)) return null;
  const store = getMemoryStore();
  const inMemory = store.get(id);
  if (inMemory) return inMemory;

  try {
    const metaPath = resolveVaultFilePath(`${id}.json`);
    if (!existsSync(metaPath)) return null;
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    let fileBuffer = null;
    const binPath = resolveVaultFilePath(`${id}.bin`);
    if (existsSync(binPath)) {
      fileBuffer = readFileSync(binPath);
    }
    const hydrated = { ...meta, fileBuffer, hasBinaryFile: Boolean(fileBuffer) };
    store.set(id, hydrated);
    return hydrated;
  } catch {
    return null;
  }
}

export function listVaultReports() {
  const store = getMemoryStore();
  return [...store.values()].map(({ fileBuffer, ...meta }) => ({
    ...meta,
    hasBinaryFile: Boolean(fileBuffer || meta.hasBinaryFile),
  }));
}
