export function computeHospitalSettlementTotals({
  subtotal,
  gstRate = 0,
  discount = 0,
}) {
  const cleanSubtotal = Math.max(0, Number(subtotal) || 0);
  const cleanRate = Math.min(28, Math.max(0, Number(gstRate) || 0));
  const cleanDiscount = Math.min(cleanSubtotal, Math.max(0, Number(discount) || 0));
  const tax = Number(((cleanSubtotal * cleanRate) / 100).toFixed(2));
  const total = Number(Math.max(1, cleanSubtotal + tax - cleanDiscount).toFixed(2));
  return {
    subtotal: Number(cleanSubtotal.toFixed(2)),
    gstRate: cleanRate,
    tax,
    discount: Number(cleanDiscount.toFixed(2)),
    total,
    amountPaise: Math.round(total * 100),
  };
}

function getSettlementSessionStore() {
  if (!globalThis.__swasthHospitalSettlements) {
    globalThis.__swasthHospitalSettlements = new Map();
  }
  return globalThis.__swasthHospitalSettlements;
}

export function saveSessionHospitalBill(userId, bill) {
  if (!userId || !bill?.id) return;
  const store = getSettlementSessionStore();
  const list = store.get(userId) || [];
  const next = [bill, ...list.filter((item) => item.id !== bill.id)].slice(0, 50);
  store.set(userId, next);
}

export function getSessionHospitalBills(userId) {
  if (!userId) return [];
  const store = getSettlementSessionStore();
  return store.get(userId) || [];
}

export function markSessionHospitalBillPaid(userId, { billId, orderId, paymentId, method, paidAt }) {
  if (!userId) return null;
  const store = getSettlementSessionStore();
  const list = store.get(userId) || [];
  let updated = null;
  const next = list.map((bill) => {
    if (bill.id === billId || (orderId && bill.razorpay_order_id === orderId)) {
      updated = {
        ...bill,
        payment_status: "paid",
        razorpay_payment_id: paymentId,
        payment_method: method || "razorpay",
        paid_at: paidAt || new Date().toISOString(),
      };
      return updated;
    }
    return bill;
  });
  store.set(userId, next);
  return updated;
}
