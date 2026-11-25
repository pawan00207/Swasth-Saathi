import { randomBytes, scryptSync } from "node:crypto";
import { requireUser } from "../../../lib/api-auth";

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const [reports, profile] = await Promise.all([
    context.prisma.report.findMany({
      where: { ownerId: context.user.id },
      include: { shareTokens: { where: { ownerId: context.user.id }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    context.prisma.profile.findUnique({ where: { userId: context.user.id }, select: { emergencyContact: true } }),
  ]);
  return Response.json({
    reports: reports.map((report) => ({
      id: report.id,
      owner_id: report.ownerId,
      patient_name: report.patientName,
      patient_reference: report.patientReference,
      report_type: report.reportType,
      report_date: report.reportDate.toISOString().slice(0, 10),
      doctor_name: report.doctorName,
      notes: report.notes,
      storage_path: report.storagePath,
      mime_type: report.mimeType,
      share_protection_enabled: report.shareProtectionEnabled,
      created_at: report.createdAt.toISOString(),
    })),
    shares: reports.flatMap((report) => report.shareTokens.map((share) => ({
      id: share.id,
      report_id: share.reportId,
      expires_at: share.expiresAt?.toISOString() || null,
      revoked_at: share.revokedAt?.toISOString() || null,
      view_count: share.viewCount,
      created_at: share.createdAt.toISOString(),
      pin_protected: Boolean(share.pinHash),
    }))),
    emergencyContact: profile?.emergencyContact || "",
  });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json();
  const reportDate = new Date(body.reportDate);
  if (
    typeof body.patientName !== "string"
    || !body.patientName.trim()
    || typeof body.reportType !== "string"
    || !body.reportType.trim()
    || Number.isNaN(reportDate.getTime())
    || typeof body.storagePath !== "string"
    || !body.storagePath.startsWith(`${context.user.id}/`)
    || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(body.mimeType)
  ) {
    return Response.json({ error: "Valid report metadata and an owner-scoped private storage path are required." }, { status: 400 });
  }
  const patientReference = typeof body.patientId === "string" ? body.patientId.trim().toUpperCase() : "";
  if (patientReference.length > 120) {
    return Response.json({ error: "Patient ID must be at most 120 characters." }, { status: 400 });
  }
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (pin && !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Share PIN must contain 4 to 6 digits." }, { status: 400 });
  }
  const pinSalt = pin ? randomBytes(16).toString("hex") : null;
  const pinHash = pin ? scryptSync(pin, pinSalt, 64).toString("hex") : null;
  const report = await context.prisma.report.create({
    data: {
      ownerId: context.user.id,
      patientReference: patientReference || null,
      patientName: body.patientName.trim().slice(0, 120),
      reportType: body.reportType.trim().slice(0, 80),
      reportDate,
      doctorName: typeof body.doctor === "string" ? body.doctor.trim().slice(0, 120) : null,
      notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null,
      storagePath: body.storagePath,
      mimeType: body.mimeType,
      shareProtectionEnabled: Boolean(pin),
      sharePinSalt: pinSalt,
      sharePinHash: pinHash,
    },
    select: { id: true },
  });
  return Response.json({ report }, { status: 201 });
}
