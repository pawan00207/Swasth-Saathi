import { createHmac, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !keyId.startsWith("rzp_test_")) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }
  const { billId, orderId, paymentId, signature } = await request.json();
  if (![billId, orderId, paymentId, signature].every((value) => typeof value === "string" && value)) {
    return Response.json({ error: "Invoice, order, payment, and signature values are required." }, { status: 400 });
  }
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest();
  const received = /^[a-f0-9]{128}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  const bill = await context.prisma.invoice.findFirst({
    where: { id: billId, patientId: context.user.id },
    select: { id: true, total: true, paymentStatus: true, razorpayOrderId: true },
  });
  if (!bill || bill.razorpayOrderId !== orderId) {
    return Response.json({ error: "Payment order does not belong to this invoice." }, { status: 403 });
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
    if (payment.status !== "captured") return Response.json({ error: "Payment is not captured yet.", status: payment.status }, { status: 409 });
    if (payment.currency !== "INR" || Number(payment.amount) !== Math.round(Number(bill.total) * 100)) {
      return Response.json({ error: "Payment amount does not match the invoice." }, { status: 400 });
    }
    const updated = await context.prisma.invoice.updateMany({
      where: { id: bill.id, patientId: context.user.id, paymentStatus: "pending", razorpayOrderId: orderId },
      data: { paymentStatus: "paid", razorpayPaymentId: paymentId },
    });
    if (!updated.count && bill.paymentStatus !== "paid") {
      return Response.json({ error: "Payment was verified but invoice status could not be updated." }, { status: 409 });
    }
    return Response.json({ status: "paid" });
  } catch (error) {
    console.error("Razorpay payment verification unavailable", error.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
