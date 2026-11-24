import { createHash, randomBytes } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";

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
    select: { id: true, patientId: true },
  });
  if (!bill) return Response.json({ error: "Invoice not found." }, { status: 404 });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await context.prisma.billVerificationToken.create({
    data: { billId: bill.id, ownerId: context.user.id, tokenHash },
  });
  return Response.json({ url: `${new URL(request.url).origin}/billing/verify/${token}` }, {
    headers: { "Cache-Control": "no-store" },
  });
}
