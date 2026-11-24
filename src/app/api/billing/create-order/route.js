import { requireUser } from "../../../../lib/api-auth";

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keyId.startsWith("rzp_test_") || !keySecret) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }
  const { billId } = await request.json();
  if (typeof billId !== "string" || !billId) return Response.json({ error: "Invoice ID is required." }, { status: 400 });
  const bill = await context.prisma.invoice.findFirst({
    where: { id: billId, patientId: context.user.id },
    select: { id: true, billNumber: true, total: true, paymentStatus: true, razorpayOrderId: true },
  });
  if (!bill) return Response.json({ error: "Invoice not found." }, { status: 404 });
  if (bill.paymentStatus !== "pending") return Response.json({ error: "Only unpaid invoices can be paid." }, { status: 409 });

  const amount = Math.round(Number(bill.total) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) return Response.json({ error: "Invoice amount is invalid." }, { status: 400 });
  if (bill.razorpayOrderId) return Response.json({ orderId: bill.razorpayOrderId, keyId, amount, currency: "INR" });

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", receipt: bill.billNumber, notes: { bill_id: bill.id, patient_id: context.user.id } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const order = await response.json();
    if (!response.ok) {
      console.error("Razorpay order creation failed", response.status);
      return Response.json({ error: "Could not create Razorpay payment order." }, { status: 502 });
    }
    const saved = await context.prisma.invoice.updateMany({
      where: { id: bill.id, patientId: context.user.id, paymentStatus: "pending", razorpayOrderId: null },
      data: { razorpayOrderId: order.id },
    });
    if (!saved.count) {
      const current = await context.prisma.invoice.findUnique({ where: { id: bill.id }, select: { razorpayOrderId: true } });
      if (current?.razorpayOrderId !== order.id) {
        return Response.json({ error: "Payment order was created but could not be linked. Contact the hospital before retrying." }, { status: 409 });
      }
    }
    return Response.json({ orderId: order.id, keyId, amount, currency: order.currency });
  } catch (error) {
    console.error("Razorpay order endpoint unavailable", error.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
