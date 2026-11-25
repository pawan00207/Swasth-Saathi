import { getPrisma } from "../../../../../lib/prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "../../../../../lib/supabase/server";
import { getPublicBaseUrl } from "../../../../../lib/url";
import { isValidReportId } from "../../../../../lib/report-vault";

export const dynamic = "force-dynamic";

const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function GET(request, { params }) {
  const rawId = (params.id || "").trim();
  if (!isValidReportId(rawId)) {
    return Response.json({ error: "Invalid report ID." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const inline = searchParams.get("inline") === "1";
  const baseUrl = getPublicBaseUrl(request);

  // 1. Check authenticated Prisma/Supabase cloud report if caller supplies Bearer token
  const supabase = getSupabaseAdmin();
  const prisma = getPrisma();
  if (supabase && prisma) {
    try {
      const user = await getAuthenticatedUser(request, supabase);
      if (user) {
        const dbReport = await prisma.report.findFirst({
          where: { id: rawId, ownerId: user.id },
        });
        if (dbReport) {
          if (format === "json") {
            return Response.json({
              report: {
                id: dbReport.id,
                patientName: dbReport.patientName,
                reportType: dbReport.reportType,
                reportDate: dbReport.reportDate.toISOString().slice(0, 10),
                doctor: dbReport.doctorName || "",
                notes: dbReport.notes || "",
                mimeType: dbReport.mimeType,
                hasBinaryFile: true,
              },
              downloadUrl: `${baseUrl}/api/reports/download/${encodeURIComponent(dbReport.id)}`,
            });
          }
          const { data: fileBlob, error: dlErr } = await supabase.storage
            .from("medical-reports")
            .download(dbReport.storagePath);
          if (!dlErr && fileBlob) {
            const bytes = Buffer.from(await fileBlob.arrayBuffer());
            const ext = MIME_TO_EXT[dbReport.mimeType] || "pdf";
            return new Response(bytes, {
              status: 200,
              headers: {
                "Content-Type": dbReport.mimeType || "application/pdf",
                "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="swasth-report-${rawId}.${ext}"`,
                "Cache-Control": "no-store",
              },
            });
          }
        }
      }
    } catch {
      return Response.json({ error: "Report storage is unavailable." }, { status: 503 });
    }
  }

  return Response.json({ error: "Report unavailable. Sign in as the owner or use a valid share link." },
    { status: 404, headers: { "Cache-Control": "no-store" } });
}
