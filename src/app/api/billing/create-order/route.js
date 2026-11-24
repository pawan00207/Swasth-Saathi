import { randomUUID } from "node:crypto";
import { requireUser } from "../../../../lib/api-auth";
import { writeAuditLog } from "../../../../lib/audit";
import { publishRealtime } from "../../../../lib/realtime-server";
import { computeHospitalSettlementTotals, saveSessionHospitalBill } from "../../../../lib/billing-settlement";
import { getAuthenticatedUser, getSupabaseAdmin } from "../../../../lib/supabase/server";

export async function POST(request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keyId.startsWith("rzp_test_") || !keySecret) {
    return Response.json({ error: "Razorpay TEST credentials are not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));

  // 1. Direct or any-hospital settlement flow
  const settlement = body.hospitalSettlement || body.directInvoice || body.invoicePayload;
  if (settlement && typeof settlement === "object") {
    const hospitalName = typeof settlement.hospitalName === "string" && settlement.hospitalName.trim()
      ? settlement.hospitalName.trim().slice(0, 140)
      : (typeof settlement.hospital === "string" && settlement.hospital.trim()
        ? settlement.hospital.trim().slice(0, 140)
        : "Partner Hospital");
    const hospitalId = typeof settlement.hospitalId === "string" && settlement.hospitalId.trim()
      ? settlement.hospitalId.trim().slice(0, 80)
      : null;
    const itemDescription = typeof settlement.description === "string" && settlement.description.trim()
      ? settlement.description.trim().slice(0, 180)
      : "Hospital Treatment & Care Settlement";

    const totals = settlement.subtotal != null
      ? computeHospitalSettlementTotals({
        subtotal: settlement.subtotal,
        gstRate: settlement.gstRate ?? 0,
        discount: settlement.discount ?? 0,
      })
      : {
        subtotal: Number(settlement.total || 0),
        gstRate: 0,
        tax: 0,
        discount: 0,
        total: Number(settlement.total || 0),
        amountPaise: Math.round(Number(settlement.total || 0) * 100),
      };

    if (!Number.isSafeInteger(totals.amountPaise) || totals.amountPaise < 100) {
      return Response.json({ error: "Settlement amount must be at least Rs. 1." }, { status: 400 });
    }

    const billNumber = String(settlement.billNumber || settlement.id || `INV-HOSP-${Date.now().toString(36).toUpperCase()}`)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 40);

    const supabase = getSupabaseAdmin();
    const authUser = supabase ? await getAuthenticatedUser(request, supabase) : null;
    const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totals.amountPaise,
          currency: "INR",
          receipt: billNumber,
          notes: {
            bill_number: billNumber,
            hospital_name: hospitalName,
            ...(authUser?.id ? { patient_id: authUser.id } : {}),
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const order = await response.json();
      if (!response.ok || !order?.id) {
        return Response.json({ error: "Could not create Razorpay payment order." }, { status: 502 });
      }

      const createdId = randomUUID();
      if (authUser?.id) {
        // Persist in Prisma or session store for the signed-in patient
        const ctx = await requireUser(request, { allowSupabaseFallback: true });
        let persistedDbId = null;

        if (ctx.prisma) {
          try {
            let resolvedHospitalId = null;
            if (hospitalId) {
              const existingHosp = await ctx.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
              resolvedHospitalId = existingHosp?.id || null;
            }
            const createdInvoice = await ctx.prisma.invoice.create({
              data: {
                billNumber,
                patientId: authUser.id,
                hospitalId: resolvedHospitalId,
                subtotal: totals.subtotal,
                tax: totals.tax,
                discount: totals.discount,
                total: totals.total,
                paymentStatus: "processing",
                razorpayOrderId: order.id,
                items: {
                  create: [
                    {
                      description: resolvedHospitalId ? itemDescription : `${hospitalName} — ${itemDescription}`,
                      quantity: 1,
                      unitPrice: totals.subtotal,
                      taxRate: totals.gstRate,
                    },
                  ],
                },
              },
              select: { id: true, billNumber: true },
            });
            persistedDbId = createdInvoice.id;
            await ctx.prisma.payment.create({
              data: {
                invoiceId: createdInvoice.id,
                razorpayOrderId: order.id,
                status: "processing",
                amount: totals.total,
                currency: "INR",
              },
            }).catch(() => {});
          } catch {
            persistedDbId = null;
          }
        }

        if (!persistedDbId) {
          saveSessionHospitalBill(authUser.id, {
            id: createdId,
            bill_number: billNumber,
            patient_id: authUser.id,
            hospital_id: hospitalId,
            subtotal: String(totals.subtotal),
            tax: String(totals.tax),
            discount: String(totals.discount),
            total: String(totals.total),
            payment_status: "processing",
            razorpay_order_id: order.id,
            razorpay_payment_id: null,
            paid_at: null,
            payment_method: null,
            created_at: new Date().toISOString(),
            bill_items: [
              {
                description: itemDescription,
                quantity: "1",
                unit_price: String(totals.subtotal),
                tax_rate: String(totals.gstRate),
              },
            ],
            payments: [],
            hospitals: { id: hospitalId, name: hospitalName },
          });
        }

        return Response.json({
          orderId: order.id,
          keyId,
          amount: totals.amountPaise,
          currency: order.currency || "INR",
          billId: persistedDbId || createdId,
          billNumber,
          hospitalName,
          total: totals.total,
          persisted: Boolean(persistedDbId),
        });
      }

      return Response.json({
        orderId: order.id,
        keyId,
        amount: totals.amountPaise,
        currency: order.currency || "INR",
        billId: billNumber,
        billNumber,
        hospitalName,
        total: totals.total,
        persisted: false,
      });
    } catch {
      return Response.json({ error: "Razorpay is temporarily unavailable." }, { status: 502 });
    }
  }

  // 2. Existing persisted invoice settlement flow
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
