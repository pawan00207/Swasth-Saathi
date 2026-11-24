import { createHash, randomBytes, scryptSync } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";

const expiryOptions = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  never: null,
};

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { reportId, expiry = "7d", pin = "" } = await request.json();
  if (typeof reportId !== "string" || !Object.prototype.hasOwnProperty.call(expiryOptions, expiry)) {
    return Response.json({ error: "A report and valid expiry are required." }, { status: 400 });
  }
  if (pin && !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "PIN must contain 4 to 6 digits." }, { status: 400 });
  }
  const report = await context.prisma.report.findFirst({ where: { id: reportId, ownerId: context.user.id } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });

  const pinSalt = pin ? randomBytes(16).toString("hex") : null;
  const pinHash = pin ? scryptSync(pin, pinSalt, 64).toString("hex") : null;
  await context.prisma.report.update({
    where: { id: report.id },
    data: {
      shareProtectionEnabled: Boolean(pin),
      sharePinSalt: pinSalt,
      sharePinHash: pinHash,
    },
  });
  await context.prisma.reportShareToken.updateMany({
    where: { reportId: report.id, ownerId: context.user.id, revokedAt: null },
    data: { pinSalt, pinHash, wrongAttempts: 0, lockedUntil: null },
  });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = expiryOptions[expiry] ? new Date(Date.now() + expiryOptions[expiry]) : null;
  const share = await context.prisma.reportShareToken.create({
    data: {
      reportId: report.id,
      ownerId: context.user.id,
      tokenHash,
      pinSalt,
      pinHash,
      expiresAt,
    },
    select: { id: true },
  });
  return Response.json({
    token,
    shareId: share.id,
    url: `${new URL(request.url).origin}/r/${token}`,
    expiresAt: expiresAt?.toISOString() || null,
  }, { headers: { "Cache-Control": "no-store" } });
}
