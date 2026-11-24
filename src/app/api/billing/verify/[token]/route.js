import { createHash } from "node:crypto";
import { getPrisma } from "../../../../../lib/prisma";

export async function GET(request, { params }) {
  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Bill verification is unavailable." }, { status: 503 });
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const token = await prisma.billVerificationToken.findUnique({
    where: { tokenHash },
    include: { invoice: true },
  });
  if (!token || token.revokedAt) return Response.json({ error: "Verification link is invalid or revoked." }, { status: 404 });
  return Response.json({
    billNumber: token.invoice.billNumber,
    total: token.invoice.total.toString(),
    paymentStatus: token.invoice.paymentStatus,
    issuedAt: token.invoice.createdAt.toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
