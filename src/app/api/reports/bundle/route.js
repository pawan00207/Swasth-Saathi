import { createHash, randomBytes, scryptSync } from "node:crypto";
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
  const { reportIds, expiry = "7d", pin = "" } = await request.json();
  if (!Array.isArray(reportIds) || reportIds.length < 1 || !Object.prototype.hasOwnProperty.call(expiryOptions, expiry)) {
    return Response.json({ error: "Select at least one report and a valid expiry." }, { status: 400 });
  }
  if (pin && !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "PIN must contain 4 to 6 digits." }, { status: 400 });
  }
  const cleanIds = [...new Set(reportIds.filter((id) => typeof id === "string" && id.trim()))];
  const ownedReports = await context.prisma.report.findMany({
    where: { id: { in: cleanIds }, ownerId: context.user.id },
    select: { id: true },
  });
  if (ownedReports.length !== cleanIds.length) {
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
