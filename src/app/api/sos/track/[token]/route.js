import { createHash } from "node:crypto";
import { getPrisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ error: "Live SOS tracking is unavailable without database setup." }, { status: 503 });
  }
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const sos = await prisma.sosEvent.findUnique({
    where: { trackingTokenHash: tokenHash },
    include: {
      profile: { select: { displayName: true } },
      hospital: { select: { name: true } },
    },
  });
  const now = new Date();
  if (!sos || sos.trackingRevokedAt || (sos.trackingExpiresAt && sos.trackingExpiresAt <= now)) {
    return Response.json({ error: "Tracking link is invalid, expired, or closed." }, { status: 404 });
  }
  const firstName = (sos.profile?.displayName || "Patient").trim().split(/\s+/)[0];
  return Response.json({
    firstName,
    status: sos.status,
    isDrill: sos.isDrill,
    neededBedType: sos.neededBedType,
    latitude: sos.latitude,
    longitude: sos.longitude,
    addressText: sos.addressText,
    hospitalName: sos.hospital?.name || null,
    updatedAt: sos.updatedAt.toISOString(),
    expiresAt: sos.trackingExpiresAt?.toISOString() || null,
  }, { headers: { "Cache-Control": "no-store" } });
}
