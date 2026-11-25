"use client";

import { useEffect, useState } from "react";

export default function BillVerificationPage({ params }) {
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
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.token]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-900">Bill verification</h1>
      <p className="mt-2 text-sm text-slate-600">
        This public page shows invoice verification fields only; no patient information is exposed.
      </p>
      {loading && <p role="status" className="mt-5">Verifying secure link...</p>}
      {error && <p role="alert" className="mt-5 rounded bg-red-50 p-4 text-red-900">{error}</p>}
      {bill && (
        <section className="mt-5 space-y-2 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{bill.hospitalName || "Hospital"}</h2>
            <span
              className={`rounded px-3 py-1 text-xs font-extrabold uppercase ${
                bill.authentic ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
              }`}
            >
              {bill.integrityStatus || (bill.authentic ? "Authentic" : "Tampered")}
            </span>
          </div>
          <p><strong>Bill number:</strong> {bill.billNumber}</p>
          <p><strong>Date:</strong> {new Date(bill.issuedAt).toLocaleDateString()}</p>
          <p><strong>Total:</strong> ₹{bill.total}</p>
          <p><strong>Payment status:</strong> {bill.paymentStatus}</p>
        </section>
      )}
    </div>
  );
}
