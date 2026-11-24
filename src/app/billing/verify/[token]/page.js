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
      .catch((reason) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.token]);

  return <main className="mx-auto max-w-xl px-4 py-10">
    <h1 className="text-3xl font-bold text-teal-900">Bill verification</h1>
    <p className="mt-2 text-sm text-slate-600">This page shows invoice verification fields only; no patient information is exposed.</p>
    {loading && <p role="status" className="mt-5">Verifying secure link...</p>}
    {error && <p role="alert" className="mt-5 rounded bg-red-50 p-4 text-red-900">{error}</p>}
    {bill && <section className="mt-5 rounded border bg-white p-5"><p><strong>Bill number:</strong> {bill.billNumber}</p><p className="mt-2"><strong>Total:</strong> ₹{bill.total}</p><p className="mt-2"><strong>Payment status:</strong> {bill.paymentStatus}</p><p className="mt-2 text-sm">Issued {new Date(bill.issuedAt).toLocaleDateString()}</p></section>}
  </main>;
}
