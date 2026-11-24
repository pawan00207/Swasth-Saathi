import { requireUser } from "../../../lib/api-auth";
import { getSessionHospitalBills } from "../../../lib/billing-settlement";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const razorpayConfigured = Boolean(keyId.startsWith("rzp_test_") && keySecret);

  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  let bills = [];
  if (context.prisma) {
    try {
      const invoices = await context.prisma.invoice.findMany({
        where: { patientId: context.user.id },
        include: {
          items: true,
          hospital: { select: { id: true, name: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      });
      bills = invoices.map((invoice) => ({
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
      }));
    } catch {
      bills = [];
    }
  }

  if (bills.length === 0 && context.supabase) {
    try {
      const { data: sbBills } = await context.supabase
        .from("bills")
        .select("*, bill_items(*), hospitals(id, name)")
        .eq("patient_id", context.user.id)
        .order("created_at", { ascending: false });
      if (Array.isArray(sbBills)) {
        bills = sbBills.map((bill) => ({
          id: bill.id,
          bill_number: bill.bill_number,
          patient_id: bill.patient_id,
          hospital_id: bill.hospital_id,
          subtotal: String(bill.subtotal ?? 0),
          tax: String(bill.tax ?? 0),
          discount: String(bill.discount ?? 0),
          total: String(bill.total ?? 0),
          payment_status: bill.payment_status || "pending",
          razorpay_order_id: bill.razorpay_order_id || null,
          razorpay_payment_id: bill.razorpay_payment_id || null,
          paid_at: bill.paid_at || null,
          payment_method: bill.payment_method || null,
          bill_hash: null,
          created_at: bill.created_at,
          bill_items: Array.isArray(bill.bill_items) ? bill.bill_items : [],
          payments: [],
          hospitals: { id: bill.hospitals?.id || null, name: bill.hospitals?.name || "Hospital" },
        }));
      }
    } catch {
      // Ignore REST errors
    }
  }

  const sessionBills = getSessionHospitalBills(context.user.id);
  const merged = [...sessionBills, ...bills.filter((b) => !sessionBills.some((sb) => sb.id === b.id))];

  return Response.json({
    razorpayConfigured,
    razorpayKeyId: razorpayConfigured ? keyId : null,
    bills: merged,
  }, { headers: { "Cache-Control": "no-store" } });
}
