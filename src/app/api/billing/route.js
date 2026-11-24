import { requireUser } from "../../../lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const razorpayConfigured = Boolean(keyId.startsWith("rzp_test_") && keySecret);

  const context = await requireUser(request);
  if (context.response) return context.response;
  const invoices = await context.prisma.invoice.findMany({
    where: { patientId: context.user.id },
    include: {
      items: true,
      hospital: { select: { id: true, name: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    razorpayConfigured,
    razorpayKeyId: razorpayConfigured ? keyId : null,
    bills: invoices.map((invoice) => ({
      id: invoice.id,
      bill_number: invoice.billNumber,
      patient_id: invoice.patientId,
      hospital_id: invoice.hospitalId,
      subtotal: invoice.subtotal.toString(),
      tax: invoice.tax.toString(),
      discount: invoice.discount.toString(),
      total: invoice.total.toString(),
      payment_status: invoice.paymentStatus,
      razorpay_order_id: invoice.razorpayOrderId,
      razorpay_payment_id: invoice.razorpayPaymentId,
      paid_at: invoice.paidAt?.toISOString() || null,
      payment_method: invoice.paymentMethod || null,
      bill_hash: invoice.billHash || null,
      created_at: invoice.createdAt.toISOString(),
      demo: invoice.demo,
      bill_items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unitPrice.toString(),
        tax_rate: item.taxRate.toString(),
      })),
      payments: invoice.payments.map((p) => ({
        id: p.id,
        status: p.status,
        razorpay_payment_id: p.razorpayPaymentId,
        method: p.method,
        paid_at: p.paidAt?.toISOString() || null,
        created_at: p.createdAt.toISOString(),
      })),
      hospitals: { id: invoice.hospital?.id || null, name: invoice.hospital?.name || "Hospital" },
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
