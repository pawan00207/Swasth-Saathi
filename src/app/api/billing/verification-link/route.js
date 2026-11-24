import { createHash, randomBytes } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { computeInvoiceHash } from "../../../../lib/audit";

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const { billId } = await request.json();
  if (typeof billId !== "string" || !billId) return Response.json({ error: "Invoice ID is required." }, { status: 400 });
  const where = context.profile.role === "hospital_admin" && context.profile.hospitalId
    ? { id: billId, OR: [{ patientId: context.user.id }, { hospitalId: context.profile.hospitalId }] }
    : { id: billId, patientId: context.user.id };
  const bill = await context.prisma.invoice.findFirst({
    where,
    include: { items: true },
  });
  if (!bill) return Response.json({ error: "Invoice not found." }, { status: 404 });

  if (!bill.billHash) {
    const hash = computeInvoiceHash(bill);
    await context.prisma.invoice.update({ where: { id: bill.id }, data: { billHash: hash } });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const created = await context.prisma.billVerificationToken.create({
    data: { billId: bill.id, ownerId: context.user.id, tokenHash },
    select: { id: true },
  });
  const origin = new URL(request.url).origin;
  return Response.json({
    tokenId: created.id,
    url: `${origin}/verify/${token}`,
    legacyUrl: `${origin}/billing/verify/${token}`,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const tokenId = new URL(request.url).searchParams.get("tokenId") || "";
  if (!tokenId) return Response.json({ error: "Token ID is required." }, { status: 400 });
  const revoked = await context.prisma.billVerificationToken.updateMany({
    where: { id: tokenId, ownerId: context.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) return Response.json({ error: "Active verification token not found." }, { status: 404 });
  return Response.json({ revoked: true });
}
