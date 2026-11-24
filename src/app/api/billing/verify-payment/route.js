import { createHmac, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";

export async function POST(request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_")) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }
  const body = await request.json();
  const { billId, orderId, paymentId, signature, demo } = body;
  if (![billId, orderId, paymentId, signature].every((value) => typeof value === "string" && value)) {
    return Response.json({ error: "Invoice, order, payment, and signature values are required." }, { status: 400 });
  }

  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
  const received = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  if (demo) {
    return Response.json({ status: "paid", paymentId, method: "razorpay_test", paidAt: new Date().toISOString(), demo: true });
  }

  const context = await requireUser(request);
  if (context.response) return context.response;

  const bill = await context.prisma.invoice.findFirst({
    where: { id: billId, patientId: context.user.id },
    select: { id: true, billNumber: true, hospitalId: true, total: true, paymentStatus: true, razorpayOrderId: true, razorpayPaymentId: true, paidAt: true, paymentMethod: true },
  });
  if (!bill || bill.razorpayOrderId !== orderId) {
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
    }
    return Response.json({ status: "paid", paymentId, method, paidAt: paidAt.toISOString() });
  } catch (error) {
    console.error("Razorpay payment verification unavailable", error.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
