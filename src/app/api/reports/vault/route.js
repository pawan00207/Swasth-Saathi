import { getPublicBaseUrl } from "../../../../lib/url";
import { isValidReportId, listVaultReports, saveVaultReport } from "../../../../lib/report-vault";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function GET() {
  return Response.json({ reports: listVaultReports() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  let id = "";
  let patientName = "";
  let patientId = "";
  let reportType = "Pathology";
  let reportDate = new Date().toISOString().slice(0, 10);
  let doctor = "";
  let notes = "";
  let fileName = "";
  let mimeType = "application/pdf";
  let fileBuffer = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    patientName = String(form.get("patientName") || "").trim();
    patientId = String(form.get("patientId") || "").trim();
    reportType = String(form.get("reportType") || "Pathology").trim();
    reportDate = String(form.get("reportDate") || reportDate).trim();
    doctor = String(form.get("doctor") || "").trim();
    notes = String(form.get("notes") || "").trim();
    const requestedId = String(form.get("id") || "").trim();
    id = requestedId && isValidReportId(requestedId)
      ? requestedId
      : `${(patientId || "REC").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "REC"}-${Date.now().toString(36).toUpperCase()}`;

    const file = form.get("file");
    if (file && typeof file.arrayBuffer === "function") {
      if (!ALLOWED_MIME.has(file.type)) {
        return Response.json({ error: "Choose a PDF, JPEG, PNG, or WebP file." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return Response.json({ error: "File must be smaller than 20 MB." }, { status: 400 });
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name || `${id}.pdf`;
      mimeType = file.type;
    }
  } else {
    const body = await request.json().catch(() => ({}));
    patientName = String(body.patientName || "").trim();
    patientId = String(body.patientId || "").trim();
    reportType = String(body.reportType || "Pathology").trim();
    reportDate = String(body.reportDate || reportDate).trim();
    doctor = String(body.doctor || "").trim();
    notes = String(body.notes || "").trim();
    const requestedId = String(body.id || "").trim();
    id = requestedId && isValidReportId(requestedId)
      ? requestedId
      : `${(patientId || "REC").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "REC"}-${Date.now().toString(36).toUpperCase()}`;
    fileName = String(body.fileName || `${id}.pdf`);
  }

  if (!patientName) {
    return Response.json({ error: "Patient name is required." }, { status: 400 });
  }

  const saved = saveVaultReport({
    id,
    patientName,
    patientId,
    reportType,
    reportDate,
    doctor,
    notes,
    fileName,
    mimeType,
    fileBuffer,
  });

  const baseUrl = getPublicBaseUrl(request);
  return Response.json(
    {
      report: saved,
      downloadUrl: `${baseUrl}/api/reports/download/${encodeURIComponent(saved.id)}`,
      viewUrl: `${baseUrl}/records/view/${encodeURIComponent(saved.id)}`,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
