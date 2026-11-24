import { createHmac, timingSafeEqual } from "node:crypto";
import { getPrisma } from "../../../../lib/prisma";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";
import { sendWhatsAppMessage } from "../../../../lib/whatsapp/provider";
import { translateKey } from "../../../../lib/i18n";

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Razorpay webhook secret is not configured." }, { status: 503 });
  }
  const signature = request.headers.get("x-razorpay-signature") || "";
  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Invalid Razorpay webhook signature." }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Malformed JSON payload." }, { status: 400 });
  }

  const event = String(payload.event || "");
  if (!["payment.captured", "payment.failed", "order.paid"].includes(event)) {
    return Response.json({ received: true, ignored: event });
  }

  const paymentEntity = payload.payload?.payment?.entity || {};
  const orderEntity = payload.payload?.order?.entity || {};
  const orderId = paymentEntity.order_id || orderEntity.id || "";
  const paymentId = paymentEntity.id || "";
  const billIdNote = paymentEntity.notes?.bill_id || orderEntity.notes?.bill_id || "";

  const prisma = getPrisma();
  if (!prisma) {
    return Response.json({ received: true, mode: "no-db" });
  }

  const invoice = await prisma.invoice.findFirst({
    where: orderId
      ? { OR: [{ razorpayOrderId: orderId }, ...(billIdNote ? [{ id: billIdNote }] : [])] }
      : { id: billIdNote },
    include: {
      patient: { select: { userId: true, preferredLanguage: true } },
    },
  });

  if (!invoice) {
    return Response.json({ received: true, unmatched: true });
  }

  if (event === "payment.failed") {
    if (invoice.paymentStatus !== "paid") {
      await prisma.invoice.updateMany({
        where: { id: invoice.id, paymentStatus: { in: ["pending", "processing"] } },
        data: { paymentStatus: "failed" },
      });
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          razorpayOrderId: orderId || invoice.razorpayOrderId,
          razorpayPaymentId: paymentId || null,
          status: "failed",
          amount: invoice.total,
          currency: "INR",
          method: paymentEntity.method || null,
          rawEvent: event,
        },
      }).catch(() => {});
      await writeAuditLog(prisma, {
        entityType: "invoice",
        entityId: invoice.id,
        action: "webhook_payment_failed",
        details: { event, orderId, paymentId },
      });
      await Promise.all([
        publishRealtime(`billing-invoice-${invoice.id}`, "updated", { invoiceId: invoice.id, status: "failed" }),
        invoice.hospitalId ? publishRealtime(`hospital-invoices-${invoice.hospitalId}`, "updated", { invoiceId: invoice.id, status: "failed" }) : Promise.resolve(),
      ]);
    }
    return Response.json({ received: true, status: "failed" });
  }

  // payment.captured or order.paid — idempotent settlement
  if (invoice.paymentStatus === "paid") {
    return Response.json({ received: true, status: "paid", idempotent: true });
  }

  const paidAt = new Date();
  const method = String(paymentEntity.method || "razorpay");
  const updated = await prisma.invoice.updateMany({
    where: { id: invoice.id, paymentStatus: { in: ["pending", "processing", "failed"] } },
    data: {
      paymentStatus: "paid",
      razorpayOrderId: orderId || invoice.razorpayOrderId,
      razorpayPaymentId: paymentId || invoice.razorpayPaymentId,
      paidAt,
      paymentMethod: method,
    },
  });

  if (updated.count) {
    if (paymentId) {
      await prisma.payment.upsert({
        where: { razorpayPaymentId: paymentId },
        create: {
          invoiceId: invoice.id,
          razorpayOrderId: orderId || invoice.razorpayOrderId,
          razorpayPaymentId: paymentId,
          status: "paid",
          amount: invoice.total,
          currency: "INR",
          method,
          rawEvent: event,
          paidAt,
        },
        update: {
          status: "paid",
          method,
          paidAt,
          rawEvent: event,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          razorpayOrderId: orderId || invoice.razorpayOrderId,
          status: "paid",
          amount: invoice.total,
          currency: "INR",
          method,
          rawEvent: event,
          paidAt,
        },
      });
    }

    await writeAuditLog(prisma, {
      entityType: "invoice",
      entityId: invoice.id,
      action: "webhook_payment_paid",
      details: { event, orderId, paymentId, method },
    });

    await Promise.all([
      publishRealtime(`billing-invoice-${invoice.id}`, "updated", { invoiceId: invoice.id, status: "paid" }),
      invoice.hospitalId ? publishRealtime(`hospital-invoices-${invoice.hospitalId}`, "updated", { invoiceId: invoice.id, status: "paid" }) : Promise.resolve(),
    ]);

    if (invoice.whatsappConsent && paymentEntity.contact) {
      const lang = invoice.patient?.preferredLanguage || "en";
      const receiptNo = `RCP-${invoice.billNumber}`;
      const msg = lang === "hi"
        ? `भुगतान प्राप्त हुआ। रसीद संख्या ${receiptNo}, चालान ${invoice.billNumber}, राशि ₹${invoice.total.toString()}।`
        : `${translateKey(lang, "appName")}: Payment received, receipt number ${receiptNo} for invoice ${invoice.billNumber} (INR ${invoice.total.toString()}).`;
      await sendWhatsAppMessage({
        to: paymentEntity.contact,
        body: msg,
        messageType: "payment_receipt",
        prisma,
      });
    }
  }

  return Response.json({ received: true, status: "paid" });
}
