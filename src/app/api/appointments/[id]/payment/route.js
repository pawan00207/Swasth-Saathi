import { requireUser } from "../../../../../lib/api-auth";

export async function POST(request, { params }) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId.startsWith("rzp_test_") || !keySecret) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }

  const context = await requireUser(request);
  if (context.response) return context.response;

  const appointment = await context.prisma.appointment.findFirst({
    where: { id: params.id, patientId: context.user.id },
    include: { doctor: { select: { name: true, fee: true } } },
  });
  if (!appointment) return Response.json({ error: "Appointment not found." }, { status: 404 });
  if (["cancelled", "completed"].includes(appointment.status)) {
    return Response.json({ error: "This appointment is not eligible for payment." }, { status: 409 });
  }

  const billNumber = `APT-${appointment.id}`;
  let invoice = await context.prisma.invoice.findUnique({ where: { billNumber } });
  if (invoice && invoice.patientId !== context.user.id) {
    return Response.json({ error: "Appointment invoice could not be verified." }, { status: 403 });
  }

  if (!invoice) {
    const fee = Number(appointment.doctor?.fee);
    const amountPaise = Math.round(fee * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
      return Response.json({ error: "The doctor does not have a payable consultation fee." }, { status: 409 });
    }

    invoice = await context.prisma.invoice.create({
      data: {
        billNumber,
        patientId: context.user.id,
        hospitalId: appointment.hospitalId,
        subtotal: amountPaise / 100,
        total: amountPaise / 100,
        paymentStatus: "pending",
        items: {
          create: [{
            description: `Teleconsultation with ${appointment.doctor?.name || "doctor"}`,
            quantity: 1,
            unitPrice: amountPaise / 100,
          }],
        },
      },
    });
  }

  if (invoice.paymentStatus === "paid") {
    return Response.json({ error: "This appointment fee has already been paid." }, { status: 409 });
  }
  const amount = Math.round(Number(invoice.total) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) {
    return Response.json({ error: "The appointment invoice amount is invalid." }, { status: 409 });
  }
  if (invoice.razorpayOrderId) {
    return Response.json({
      orderId: invoice.razorpayOrderId,
      keyId,
      amount,
      currency: "INR",
      billId: invoice.id,
      billNumber,
      total: amount / 100,
    });
  }

  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: billNumber,
        notes: { bill_id: invoice.id, appointment_id: appointment.id },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const order = await response.json();
    if (!response.ok || !order?.id) {
      return Response.json({ error: "Could not create Razorpay payment order." }, { status: 502 });
    }

    const updated = await context.prisma.invoice.updateMany({
      where: { id: invoice.id, patientId: context.user.id, razorpayOrderId: null, paymentStatus: { not: "paid" } },
      data: { razorpayOrderId: order.id, paymentStatus: "processing" },
    });
    if (!updated.count) {
      const current = await context.prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { razorpayOrderId: true, paymentStatus: true },
      });
      if (current?.paymentStatus === "paid") {
        return Response.json({ error: "This appointment fee has already been paid." }, { status: 409 });
      }
      if (current?.razorpayOrderId) {
        return Response.json({
          orderId: current.razorpayOrderId,
          keyId,
          amount,
          currency: "INR",
          billId: invoice.id,
          billNumber,
          total: amount / 100,
        });
      }
      return Response.json({ error: "Payment order could not be linked to the appointment invoice." }, { status: 409 });
    }

    await context.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        razorpayOrderId: order.id,
        status: "processing",
        amount: amount / 100,
        currency: "INR",
      },
    });

    return Response.json({
      orderId: order.id,
      keyId,
      amount,
      currency: order.currency || "INR",
      billId: invoice.id,
      billNumber,
      total: amount / 100,
    });
  } catch (error) {
    console.error("Razorpay appointment order endpoint unavailable", error?.name || "provider error");
    return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
  }
}
