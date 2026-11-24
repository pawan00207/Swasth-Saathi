import { requireUser } from "../../../lib/api-auth";

export async function GET(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const invoices = await context.prisma.invoice.findMany({
    where: { patientId: context.user.id },
    include: { items: true, hospital: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    bills: invoices.map((invoice) => ({
      id: invoice.id,
      bill_number: invoice.billNumber,
      patient_id: invoice.patientId,
      subtotal: invoice.subtotal.toString(),
      tax: invoice.tax.toString(),
      discount: invoice.discount.toString(),
      total: invoice.total.toString(),
      payment_status: invoice.paymentStatus,
      razorpay_order_id: invoice.razorpayOrderId,
      created_at: invoice.createdAt.toISOString(),
      demo: invoice.demo,
      bill_items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unitPrice.toString(),
        tax_rate: item.taxRate.toString(),
      })),
      hospitals: { name: invoice.hospital?.name || "Hospital" },
    })),
  });
}
