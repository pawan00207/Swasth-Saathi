import { createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { getPublicBaseUrl } from "../../../../lib/url";

const expiryOptions = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  never: null,
};

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const bundles = await context.prisma.reportBundleShareToken.findMany({
    where: { ownerId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    bundles: bundles.map((b) => ({
      id: b.id,
      reportIds: b.reportIds,
      patientReference: b.patientReference,
      expiresAt: b.expiresAt?.toISOString() || null,
      revokedAt: b.revokedAt?.toISOString() || null,
      viewCount: b.viewCount,
      pinProtected: Boolean(b.pinHash),
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { reportIds, patientReportId, expiry = "7d", pin = "" } = await request.json();
  const patientShare = typeof patientReportId === "string" && patientReportId.length > 0;
  if ((!patientShare && (!Array.isArray(reportIds) || reportIds.length < 1)) || !Object.prototype.hasOwnProperty.call(expiryOptions, expiry)) {
    return Response.json({ error: "Select at least one report and a valid expiry." }, { status: 400 });
  }
  if (typeof pin !== "string" || (pin && !/^\d{4,6}$/.test(pin))) {
    return Response.json({ error: "PIN must contain 4 to 6 digits." }, { status: 400 });
  }
  if (patientShare) return createPatientShare(request, context, patientReportId, expiry, pin);
  const cleanIds = [...new Set(reportIds.filter((id) => typeof id === "string" && id.trim()))];
  const ownedReports = await context.prisma.report.findMany({
    where: { id: { in: cleanIds }, ownerId: context.user.id },
    select: { id: true },
  });
  if (!cleanIds.length || ownedReports.length !== cleanIds.length) {
    return Response.json({ error: "One or more selected reports were not found." }, { status: 404 });
  }

  const pinSalt = pin ? randomBytes(16).toString("hex") : null;
  const pinHash = pin ? scryptSync(pin, pinSalt, 64).toString("hex") : null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = expiryOptions[expiry] ? new Date(Date.now() + expiryOptions[expiry]) : null;

  const bundle = await context.prisma.reportBundleShareToken.create({
    data: {
      ownerId: context.user.id,
      reportIds: cleanIds,
      tokenHash,
      pinSalt,
      pinHash,
      expiresAt,
    },
    select: { id: true },
  });

  return Response.json({
    token,
    bundleId: bundle.id,
    reportCount: cleanIds.length,
    url: `${getPublicBaseUrl(request)}/r/bundle/${token}`,
    expiresAt: expiresAt?.toISOString() || null,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function createPatientShare(request, { prisma, user }, reportId, expiry, pin) {
  const key = process.env.REPORT_QR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) return Response.json({ error: "Patient QR sharing is unavailable." }, { status: 503 });

  const report = await prisma.report.findFirst({
    where: { id: reportId, ownerId: user.id },
    select: { patientReference: true },
  });
  if (!report?.patientReference) {
    return Response.json({ error: "The report needs a patient ID to create a patient QR." }, { status: 404 });
  }

  const scope = { ownerId: user.id, patientReference: report.patientReference };
  const tokenFor = (id) => createHmac("sha256", key).update("patient-report-qr:" + id).digest("base64url");
  const hashToken = (token) => createHash("sha256").update(token).digest("hex");
  const result = await prisma.$transaction(async (tx) => {
    const lockKey = JSON.stringify([user.id, report.patientReference]);
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const now = new Date();
    const existing = await tx.reportBundleShareToken.findFirst({
      where: { ...scope, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    if (existing) {
      const token = tokenFor(existing.id);
      if (hashToken(token) !== existing.tokenHash) return null;
      return { bundle: existing, token, reused: true };
    }

    const id = randomBytes(24).toString("hex");
    const token = tokenFor(id);
    const pinSalt = pin ? randomBytes(16).toString("hex") : null;
    const bundle = await tx.reportBundleShareToken.create({
      data: {
        ...scope, id, tokenHash: hashToken(token), pinSalt,
        pinHash: pin ? scryptSync(pin, pinSalt, 64).toString("hex") : null,
        expiresAt: expiryOptions[expiry] ? new Date(now.getTime() + expiryOptions[expiry]) : null,
      },
    });
    return { bundle, token, reused: false };
  });
  if (!result) {
    return Response.json({ error: "The QR signing key changed. Revoke the active patient QR in My Reports to create a new one." }, { status: 409 });
  }
  const { bundle, token, reused } = result;
  return Response.json({
    bundleId: bundle.id,
    url: `${getPublicBaseUrl(request)}/r/bundle/${token}`,
    pinProtected: Boolean(bundle.pinHash),
    expiresAt: bundle.expiresAt?.toISOString() || null,
    reused,
  }, { status: reused ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
