import { randomUUID } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase/server";

function isMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || !context.profile.hospitalId) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const invoices = await context.prisma.invoice.findMany({
    where: { hospitalId: context.profile.hospitalId },
    include: { items: true, patient: { select: { displayName: true, userId: true } }, hospital: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ invoices });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || !context.profile.hospitalId) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const body = await request.json();
  if (
    typeof body.patientId !== "string"
    || !/^[0-9a-f-]{36}$/i.test(body.patientId)
    || !Array.isArray(body.items)
    || body.items.length < 1
    || body.items.length > 30
    || !isMoney(body.discount)
  ) {
    return Response.json({ error: "A valid patient ID, line items, and non-negative discount are required." }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const patientAccount = await supabase.auth.admin.getUserById(body.patientId);
  if (patientAccount.error || !patientAccount.data.user) {
    return Response.json({ error: "Patient account was not found." }, { status: 404 });
  }
  const items = body.items.map((item) => ({
    description: typeof item.description === "string" ? item.description.trim().slice(0, 200) : "",
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    taxRate: Number(item.taxRate),
  }));
  if (items.some((item) =>
    !item.description
    || !Number.isFinite(item.quantity)
    || item.quantity <= 0
    || !isMoney(item.unitPrice)
    || !isMoney(item.taxRate)
    || item.taxRate > 100
  )) {
    return Response.json({ error: "Each line item needs a description, positive quantity, price, and valid GST rate." }, { status: 400 });
  }
  const patient = await context.prisma.profile.upsert({
    where: { userId: body.patientId },
    create: { userId: body.patientId, displayName: typeof body.patientName === "string" ? body.patientName.trim().slice(0, 120) : "" },
    update: typeof body.patientName === "string" && body.patientName.trim()
      ? { displayName: body.patientName.trim().slice(0, 120) }
      : {},
  });
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = items.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate / 100, 0);
  const discount = Number(body.discount);
  if (discount > subtotal + tax) return Response.json({ error: "Discount cannot exceed the invoice total." }, { status: 400 });
  const invoice = await context.prisma.invoice.create({
    data: {
      billNumber: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
      patientId: patient.userId,
      hospitalId: context.profile.hospitalId,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: discount.toFixed(2),
      total: (subtotal + tax - discount).toFixed(2),
      items: {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          taxRate: item.taxRate.toFixed(2),
        })),
      },
    },
    include: { items: true, patient: { select: { displayName: true, userId: true } }, hospital: { select: { name: true } } },
  });
  return Response.json({ invoice }, { status: 201 });
}

export async function PATCH(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || !context.profile.hospitalId) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const { invoiceId, status } = await request.json();
  if (typeof invoiceId !== "string" || !["paid", "pending"].includes(status)) {
    return Response.json({ error: "Select an invoice and paid or unpaid status." }, { status: 400 });
  }
  const updated = await context.prisma.invoice.updateMany({
    where: { id: invoiceId, hospitalId: context.profile.hospitalId },
    data: { paymentStatus: status },
  });
  if (!updated.count) return Response.json({ error: "Invoice not found for this hospital." }, { status: 404 });
  const invoice = await context.prisma.invoice.findUnique({ where: { id: invoiceId } });
  return Response.json({ invoice });
}
