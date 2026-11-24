"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { generatePdf } from "../../../lib/generatePdf";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";

const emptyItem = () => ({ description: "", quantity: "1", unitPrice: "", taxRate: "0" });

export default function InvoiceAdminPage() {
  const [token, setToken] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(accessToken) {
    const response = await fetch("/api/admin/invoices", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load invoice history.");
    setInvoices(result.invoices || []);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase?.auth.getSession() || { data: { session: null }, error: null };
      if (error) throw error;
      if (!data.session) {
        setMessage("Sign in with an authorized hospital administrator account.");
        return;
      }
      if (!active) return;
      setToken(data.session.access_token);
      await load(data.session.access_token);
    }
    initialize().catch((error) => { if (active) setMessage(error.message || "Could not load invoice administration."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, position) => position === index ? { ...item, [key]: value } : item));
  }

  async function createInvoice(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId, patientName, discount, items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create invoice.");
      setInvoices((current) => [result.invoice, ...current]);
      setPatientId("");
      setPatientName("");
      setDiscount("0");
      setItems([emptyItem()]);
      setMessage(`Invoice ${result.invoice.billNumber} created.`);
    } catch (error) {
      setMessage(error.message || "Could not create invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(invoiceId, status) {
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoiceId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update invoice status.");
      setInvoices((current) => current.map((invoice) => invoice.id === invoiceId ? { ...invoice, paymentStatus: status } : invoice));
      setMessage(`${result.invoice.billNumber} marked ${status === "paid" ? "paid" : "unpaid"}.`);
    } catch (error) {
      setMessage(error.message || "Could not update invoice status.");
    }
  }

  async function downloadInvoice(invoice, format) {
    try {
      if (format === "json") {
        const url = URL.createObjectURL(new Blob([JSON.stringify(invoice, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${invoice.billNumber}.json`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      const response = await fetch("/api/billing/verification-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ billId: invoice.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create verification QR.");
      const qr = await QRCode.toDataURL(result.url);
      await generatePdf({
        fileName: `${invoice.billNumber}.pdf`,
        title: "Hospital Billing Invoice",
        watermark: "INVOICE - VERIFY PAYMENT STATUS ONLINE",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setFontSize(11);
          document.text(`Invoice: ${invoice.billNumber}`, 15, 42);
          document.text(`Hospital: ${invoice.hospital?.name || "Hospital"}`, 15, 51);
          document.text(`Patient: ${invoice.patient.displayName || invoice.patient.userId}`, 15, 60);
          document.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 15, 69);
          document.text(`Status: ${invoice.paymentStatus}`, 15, 78);
          let y = 93;
          invoice.items.forEach((item) => {
            document.text(`${item.description} · Qty ${item.quantity} · GST ${item.taxRate}%`, 15, y, { maxWidth: 135 });
            document.text(`Rs. ${Number(item.quantity) * Number(item.unitPrice)}`, 190, y, { align: "right" });
            y += 9;
          });
          document.setFont(fontFamily, "bold");
          document.text(`Subtotal: Rs. ${invoice.subtotal}`, 190, y + 7, { align: "right" });
          document.text(`GST: Rs. ${invoice.tax}`, 190, y + 15, { align: "right" });
          document.text(`Discount: Rs. ${invoice.discount}`, 190, y + 23, { align: "right" });
          document.text(`Total: Rs. ${invoice.total}`, 190, y + 31, { align: "right" });
          document.addImage(qr, "PNG", 164, 235, 28, 28);
          document.setFont(fontFamily, "normal");
          document.setFontSize(8);
          document.text("Bill verification", 164, 267);
        },
      });
    } catch (error) {
      setMessage(error.message || "Could not download invoice.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Invoice administration</h1>
      <p className="mt-2 text-slate-600">Create itemized invoices for patients and review this hospital’s invoice history.</p>
      {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3">{message}</p>}
      {loading && <p role="status" className="mt-4">Loading invoice workflow...</p>}
      {token && <form onSubmit={createInvoice} className="mt-6 space-y-4 rounded-lg border bg-white p-5">
        <h2 className="text-xl font-bold">Create invoice</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label>Patient Supabase user ID<input required className="mt-1 w-full rounded border px-3 py-2" value={patientId} onChange={(event) => setPatientId(event.target.value)} /></label>
          <label>Patient name (optional)<input className="mt-1 w-full rounded border px-3 py-2" value={patientName} onChange={(event) => setPatientName(event.target.value)} /></label>
        </div>
        {items.map((item, index) => <fieldset key={index} className="grid gap-3 rounded border p-3 md:grid-cols-4">
          <legend className="px-1">Line item {index + 1}</legend>
          <label className="md:col-span-2">Description<input required className="mt-1 w-full rounded border px-3 py-2" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></label>
          <label>Quantity<input required type="number" min="0.01" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
          <label>Unit price (INR)<input required type="number" min="0" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} /></label>
          <label>GST / tax (%)<input required type="number" min="0" max="100" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={item.taxRate} onChange={(event) => updateItem(index, "taxRate", event.target.value)} /></label>
          {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, position) => position !== index))} className="self-end rounded border border-red-700 px-3 py-2 text-red-900">Remove item</button>}
        </fieldset>)}
        <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="rounded border px-3 py-2">Add line item</button>
        <label className="block max-w-sm">Discount (INR)<input type="number" min="0" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
        <button disabled={busy} className="rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Creating..." : "Create invoice"}</button>
      </form>}
      <section className="mt-8">
        <h2 className="text-xl font-bold">Invoice history</h2>
        <div className="mt-3 space-y-3">
          {invoices.map((invoice) => <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-bold">{invoice.billNumber}</h3>
              <p className="text-sm text-slate-600">{invoice.patient.displayName || invoice.patient.userId} · {new Date(invoice.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-sm">Subtotal ₹{invoice.subtotal.toString()} · GST ₹{invoice.tax.toString()} · Discount ₹{invoice.discount.toString()} · <strong>Total ₹{invoice.total.toString()}</strong></p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-1 text-sm">{invoice.paymentStatus}</span>
              <button onClick={() => downloadInvoice(invoice, "pdf")} className="rounded border px-3 py-2">PDF</button>
              <button onClick={() => downloadInvoice(invoice, "json")} className="rounded border px-3 py-2">JSON</button>
              <button onClick={() => setStatus(invoice.id, invoice.paymentStatus === "paid" ? "pending" : "paid")} className="rounded border px-3 py-2">
                Mark {invoice.paymentStatus === "paid" ? "unpaid" : "paid"}
              </button>
            </div>
          </article>)}
          {!loading && invoices.length === 0 && <p className="rounded border border-dashed p-6 text-slate-600">No invoices have been created for this hospital.</p>}
        </div>
      </section>
    </main>
  );
}
