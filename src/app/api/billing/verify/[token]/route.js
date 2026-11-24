import { createHash } from "node:crypto";
import { getPrisma } from "../../../../../lib/prisma";
import { computeInvoiceHash } from "../../../../../lib/audit";

const verifyRateLimits = new Map();

export async function GET(request, { params }) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  for (const [key, entry] of verifyRateLimits) {
    if (entry.resetAt <= now) verifyRateLimits.delete(key);
  }
  const bucket = verifyRateLimits.get(ip);
  if (bucket && bucket.resetAt > now && bucket.count >= 30) {
    return Response.json({ error: "Too many verification requests. Please wait a minute." }, { status: 429 });
  }
  verifyRateLimits.set(
    ip,
    bucket && bucket.resetAt > now
      ? { count: bucket.count + 1, resetAt: bucket.resetAt }
      : { count: 1, resetAt: now + 60_000 },
  );

  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Bill verification is unavailable." }, { status: 503 });
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const token = await prisma.billVerificationToken.findUnique({
    where: { tokenHash },
    include: {
      invoice: {
        include: {
          hospital: { select: { name: true } },
          items: true,
        },
      },
    },
  });
  if (!token || token.revokedAt) {
    return Response.json({ error: "Verification link is invalid or revoked." }, { status: 404 });
  }
  const invoice = token.invoice;
  const recomputedHash = computeInvoiceHash(invoice);
  const authentic = !invoice.billHash || invoice.billHash === recomputedHash;

  return Response.json({
    hospitalName: invoice.hospital?.name || "Hospital",
    billNumber: invoice.billNumber,
    total: invoice.total.toString(),
    paymentStatus: invoice.paymentStatus,
    issuedAt: invoice.createdAt.toISOString(),
    authentic,
    integrityStatus: authentic ? "Authentic" : "Tampered",
  }, { headers: { "Cache-Control": "no-store" } });
}
