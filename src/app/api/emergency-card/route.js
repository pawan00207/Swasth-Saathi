import { createHash, randomBytes } from "node:crypto";
import { requireUser } from "../../../lib/api-auth";
import { writeAuditLog } from "../../../lib/audit";
import { getPublicBaseUrl } from "../../../lib/url";

export const dynamic = "force-dynamic";

const expiryMap = {
  "30d": 30 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  never: null,
};

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const tokens = await context.prisma.emergencyCardToken.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ tokens });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const body = await request.json().catch(() => ({}));
  const expiry = Object.prototype.hasOwnProperty.call(expiryMap, body.expiry) ? body.expiry : "1y";

  const emergencyProfile = await context.prisma.emergencyProfile.findUnique({
    where: { userId: context.user.id },
  });
  if (!emergencyProfile || !emergencyProfile.cardEnabled) {
    return Response.json({ error: "Enable the Emergency QR Card opt-in in your Emergency Profile first." }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = expiryMap[expiry] ? new Date(Date.now() + expiryMap[expiry]) : null;
  const created = await context.prisma.emergencyCardToken.create({
    data: {
      userId: context.user.id,
      tokenHash,
      expiresAt,
    },
    select: { id: true, expiresAt: true, createdAt: true },
  });

  await writeAuditLog(context.prisma, {
    entityType: "emergency_card",
    entityId: created.id,
    actorId: context.user.id,
    action: "created",
    details: { expiry },
  });

  const origin = getPublicBaseUrl(request);
  return Response.json({
    id: created.id,
    token,
    url: `${origin}/e/${token}`,
    expiresAt: created.expiresAt?.toISOString() || null,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return Response.json({ error: "Card token ID is required." }, { status: 400 });
  const revoked = await context.prisma.emergencyCardToken.updateMany({
    where: { id, userId: context.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) return Response.json({ error: "Active emergency card token not found." }, { status: 404 });
  await writeAuditLog(context.prisma, {
    entityType: "emergency_card",
    entityId: id,
    actorId: context.user.id,
    action: "revoked",
    details: {},
  });
  return Response.json({ revoked: true });
}
