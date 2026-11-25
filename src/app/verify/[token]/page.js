"use client";

import { useEffect, useState } from "react";

export default function PublicVerifyBillPage({ params }) {
  const [bill, setBill] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/billing/verify/${encodeURIComponent(params.token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not verify this bill.");
        if (active) setBill(data);
      })
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.token]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-900">Care Wallet Bill Verification</h1>
      <p className="mt-2 text-sm text-slate-600">
        Public verification shows only hospital name, bill number, date, total, and integrity status. No patient details are exposed.
      </p>
      {loading && <p role="status" className="mt-5">Verifying secure bill link...</p>}
      {error && <p role="alert" className="mt-5 rounded bg-red-50 p-4 text-red-900">{error}</p>}
      {bill && (
        <section className="mt-5 rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-600">{bill.hospitalName}</span>
            <span className={`rounded px-3 py-1 text-xs font-bold ${bill.authentic ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
              {bill.integrityStatus || (bill.authentic ? "Authentic" : "Tampered")}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="inline font-semibold">Bill number:</dt> <dd className="inline">{bill.billNumber}</dd></div>
            <div><dt className="inline font-semibold">Date:</dt> <dd className="inline">{new Date(bill.issuedAt).toLocaleDateString("en-IN")}</dd></div>
            <div><dt className="inline font-semibold">Total:</dt> <dd className="inline">₹{bill.total}</dd></div>
            <div><dt className="inline font-semibold">Payment status:</dt> <dd className="inline capitalize">{bill.paymentStatus}</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
