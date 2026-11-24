import { requireUser } from "../../../../lib/api-auth";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";

export async function POST(request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keyId.startsWith("rzp_test_") || !keySecret) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }

  const body = await request.json();

  // Support Demo bill test checkout without requiring DB auth if demoBill payload is provided
  if (body.demoBill && typeof body.demoBill === "object") {
    const amount = Math.round(Number(body.demoBill.total || 0) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return Response.json({ error: "Demo invoice amount is invalid." }, { status: 400 });
    }
    const receipt = String(body.demoBill.id || "DEMO-BILL").slice(0, 40);
    const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt,
          notes: { bill_id: receipt, demo: "true" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const order = await response.json();
      if (!response.ok) {
        return Response.json({ error: "Could not create Razorpay TEST order." }, { status: 502 });
      }
      return Response.json({ orderId: order.id, keyId, amount, currency: order.currency, demo: true });
    } catch {
      return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
    }
  }

  const context = await requireUser(request);
  if (context.response) return context.response;
  const { billId } = body;
  if (typeof billId !== "string" || !billId) return Response.json({ error: "Invoice ID is required." }, { status: 400 });
  const bill = await context.prisma.invoice.findFirst({
    where: { id: billId, patientId: context.user.id },
    select: { id: true, billNumber: true, hospitalId: true, total: true, paymentStatus: true, razorpayOrderId: true },
  });
  if (!bill) return Response.json({ error: "Invoice not found." }, { status: 404 });
  if (!["pending", "failed", "processing"].includes(bill.paymentStatus)) {
    return Response.json({ error: "Only unpaid or failed invoices can be paid." }, { status: 409 });
  }

  const amount = Math.round(Number(bill.total) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) return Response.json({ error: "Invoice amount is invalid." }, { status: 400 });

  if (bill.razorpayOrderId) {
    await context.prisma.invoice.updateMany({
      where: { id: bill.id, patientId: context.user.id, paymentStatus: { in: ["pending", "failed"] } },
      data: { paymentStatus: "processing" },
    });
    return Response.json({ orderId: bill.razorpayOrderId, keyId, amount, currency: "INR" });
  }

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: bill.billNumber,
        notes: { bill_id: bill.id, patient_id: context.user.id },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const order = await response.json();
    if (!response.ok) {
      console.error("Razorpay order creation failed", response.status);
      return Response.json({ error: "Could not create Razorpay payment order." }, { status: 502 });
    }
    const saved = await context.prisma.invoice.updateMany({
      where: { id: bill.id, patientId: context.user.id, paymentStatus: { in: ["pending", "failed"] }, razorpayOrderId: null },
      data: { razorpayOrderId: order.id, paymentStatus: "processing" },
    });
    if (!saved.count) {
      const current = await context.prisma.invoice.findUnique({ where: { id: bill.id }, select: { razorpayOrderId: true } });
      if (current?.razorpayOrderId !== order.id) {
        return Response.json({ error: "Payment order was created but could not be linked. Contact the hospital before retrying." }, { status: 409 });
      }
    }
    await context.prisma.payment.create({
      data: {
        invoiceId: bill.id,
        razorpayOrderId: order.id,
        status: "processing",
        amount: bill.total,
        currency: "INR",
      },
    });
    await writeAuditLog(context.prisma, {
      entityType: "invoice",
      entityId: bill.id,
      actorId: context.user.id,
      action: "payment_processing",
      details: { orderId: order.id },
    });
    await Promise.all([
      publishRealtime(`billing-invoice-${bill.id}`, "updated", { invoiceId: bill.id, status: "processing" }),
      bill.hospitalId ? publishRealtime(`hospital-invoices-${bill.hospitalId}`, "updated", { invoiceId: bill.id, status: "processing" }) : Promise.resolve(),
    ]);
    return Response.json({ orderId: order.id, keyId, amount, currency: order.currency });
  } catch (error) {
    console.error("Razorpay order endpoint unavailable", error.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
