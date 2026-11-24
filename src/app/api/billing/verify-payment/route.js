import { createHmac, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";
import { markSessionHospitalBillPaid } from "../../../../lib/billing-settlement";
import { notifyPaymentSettlementTelegram } from "../../../../lib/telegram";
import { getAuthenticatedUser, getSupabaseAdmin } from "../../../../lib/supabase/server";

export async function POST(request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_")) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const { billId, orderId, paymentId, signature, directInvoice, hospitalName, billNumber, total } = body;
  if (![billId, orderId, paymentId, signature].every((value) => typeof value === "string" && value)) {
    return Response.json({ error: "Invoice, order, payment, and signature values are required." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
  const received = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  if (directInvoice) {
    const paidAt = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const authUser = supabase ? await getAuthenticatedUser(request, supabase) : null;
    if (authUser?.id) {
      markSessionHospitalBillPaid(authUser.id, {
        billId,
        orderId,
        paymentId,
        method: "razorpay",
        paidAt,
      });
    }
    notifyPaymentSettlementTelegram({
      billNumber: String(billNumber || billId),
      hospitalName: typeof hospitalName === "string" && hospitalName.trim() ? hospitalName.trim() : "Partner Hospital",
      amountInr: Number(total || 0),
      paymentId,
    }).catch(() => {});
    return Response.json({ status: "paid", paymentId, method: "razorpay_verified", paidAt });
  }

  const context = await requireUser(request, { allowSupabaseFallback: true });
  if (context.response) return context.response;

  if (!context.prisma) {
    const paidAt = new Date().toISOString();
    const updatedSession = markSessionHospitalBillPaid(context.user.id, {
      billId,
      orderId,
      paymentId,
      method: "razorpay",
      paidAt,
    });
    if (!updatedSession) {
      return Response.json({ error: "Payment order does not belong to this invoice." }, { status: 403 });
    }
    notifyPaymentSettlementTelegram({
      billNumber: updatedSession.bill_number || billId,
      hospitalName: updatedSession.hospitals?.name || hospitalName || "Partner Hospital",
      amountInr: Number(updatedSession.total || total || 0),
      paymentId,
    }).catch(() => {});
    return Response.json({ status: "paid", paymentId, method: "razorpay", paidAt });
  }

  const bill = await context.prisma.invoice.findFirst({
    where: { id: billId, patientId: context.user.id },
    include: { hospital: { select: { name: true } } },
  });
  if (!bill || bill.razorpayOrderId !== orderId) {
    const updatedSession = markSessionHospitalBillPaid(context.user.id, {
      billId,
      orderId,
      paymentId,
      method: "razorpay",
      paidAt: new Date().toISOString(),
    });
    if (updatedSession) {
      return Response.json({
        status: "paid",
        paymentId,
        method: "razorpay",
        paidAt: updatedSession.paid_at,
      });
    }
    return Response.json({ error: "Payment order does not belong to this invoice." }, { status: 403 });
  }

  if (bill.paymentStatus === "paid") {
    return Response.json({
      status: "paid",
      idempotent: true,
      paymentId: bill.razorpayPaymentId || paymentId,
      method: bill.paymentMethod || "razorpay",
      paidAt: bill.paidAt?.toISOString() || new Date().toISOString(),
    });
  }

  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const payment = await response.json();
    if (!response.ok || payment.order_id !== orderId) {
      console.error("Razorpay payment lookup failed", response.status);
      return Response.json({ error: "Could not confirm payment with Razorpay." }, { status: 502 });
    }
    if (payment.status !== "captured") {
      return Response.json({ error: "Payment is not captured yet.", status: payment.status }, { status: 409 });
    }
    if (payment.currency !== "INR" || Number(payment.amount) !== Math.round(Number(bill.total) * 100)) {
      return Response.json({ error: "Payment amount does not match the invoice." }, { status: 400 });
    }
    const paidAt = new Date();
    const method = String(payment.method || "razorpay");
    const updated = await context.prisma.invoice.updateMany({
      where: {
        id: bill.id,
        patientId: context.user.id,
        paymentStatus: { in: ["pending", "processing", "failed"] },
        razorpayOrderId: orderId,
      },
      data: {
        paymentStatus: "paid",
        razorpayPaymentId: paymentId,
        paidAt,
        paymentMethod: method,
      },
    });
    if (updated.count) {
      await context.prisma.payment.upsert({
        where: { razorpayPaymentId: paymentId },
        create: {
          invoiceId: bill.id,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          status: "paid",
          amount: bill.total,
          currency: "INR",
          method,
          rawEvent: "client.verify",
          paidAt,
        },
        update: {
          status: "paid",
          method,
          paidAt,
        },
      });
      await writeAuditLog(context.prisma, {
        entityType: "invoice",
        entityId: bill.id,
        actorId: context.user.id,
        action: "payment_paid",
        details: { paymentId, method },
      });
      await Promise.all([
        publishRealtime(`billing-invoice-${bill.id}`, "updated", { invoiceId: bill.id, status: "paid" }),
        bill.hospitalId ? publishRealtime(`hospital-invoices-${bill.hospitalId}`, "updated", { invoiceId: bill.id, status: "paid" }) : Promise.resolve(),
      ]);
      notifyPaymentSettlementTelegram({
        billNumber: bill.billNumber,
        hospitalName: bill.hospital?.name || hospitalName || "Partner Hospital",
        amountInr: Number(bill.total),
        paymentId,
        prisma: context.prisma,
      }).catch(() => {});
    }
    return Response.json({ status: "paid", paymentId, method, paidAt: paidAt.toISOString() });
  } catch (error) {
    console.error("Razorpay payment verification unavailable", error.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
