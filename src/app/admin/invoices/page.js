"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { generatePdf } from "../../../lib/generatePdf";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../../lib/useRealtimeRefresh";
import { DEFAULT_SERVICE_CATALOG } from "../../../lib/service-catalog";
import { useI18n } from "../../../components/I18nProvider";

const emptyItem = () => ({ description: "", quantity: "1", unitPrice: "", taxRate: "0" });

export default function InvoiceAdminPage() {
  const { language, formatCurrency } = useI18n();
  const [token, setToken] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [catalog, setCatalog] = useState(DEFAULT_SERVICE_CATALOG);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (accessToken = token) => {
    if (!accessToken) return;
    const response = await fetch("/api/admin/invoices", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load invoice history.");
    setInvoices(result.invoices || []);
  }, [token]);

  useEffect(() => {
    fetch("/api/service-catalog", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items?.length) setCatalog(data.items);
      })
      .catch(() => {});
  }, []);

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
      const accessToken = data.session.access_token;
      setToken(accessToken);

      const profileRes = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (profileRes.ok) {
        const prof = await profileRes.json();
        if (prof.profile?.hospitalId) setHospitalId(prof.profile.hospitalId);
      }

      await load(accessToken);
    }
    initialize()
      .catch((error) => {
        if (active) setMessage(error.message || "Could not load invoice administration.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useRealtimeRefresh(
    token && hospitalId ? [{ name: `hospital-invoices-${hospitalId}`, private: true }] : [],
    () => load(token),
    15000,
  );

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, position) => (position === index ? { ...item, [key]: value } : item)));
  }

  function applyCatalogPreset(index, presetName) {
    const match = catalog.find((c) => c.name === presetName);
    if (!match) return;
    setItems((current) =>
      current.map((item, position) =>
        position === index
          ? { ...item, description: match.name, taxRate: String(match.gstRate ?? 0) }
          : item,
      ),
    );
  }

  async function createInvoice(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId, patientName, discount, whatsappConsent, items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create invoice.");
      setInvoices((current) => [result.invoice, ...current]);
      setPatientId("");
      setPatientName("");
      setWhatsappConsent(false);
      setDiscount("0");
      setItems([emptyItem()]);
      setMessage(`Invoice ${result.invoice.billNumber} created with GST breakdown & integrity seal.`);
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
      await load(token);
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

      if (format === "receipt") {
        const receiptNo = `RCP-${invoice.billNumber}`;
        await generatePdf({
          fileName: `${receiptNo}.pdf`,
          title: "Official Payment Receipt",
          locale: language,
          watermark: "PAID PAYMENT RECEIPT",
          draw: (document, fontFamily) => {
            document.setFont(fontFamily);
            document.setTextColor(15, 118, 110);
            document.setFontSize(18);
            document.text("PAID", 185, 42, { align: "right" });
            document.setDrawColor(15, 118, 110);
            document.rect(160, 33, 30, 12);

            document.setTextColor(30, 41, 59);
            document.setFontSize(11);
            document.text(`Receipt: ${receiptNo}`, 15, 42);
            document.text(`Invoice: ${invoice.billNumber}`, 15, 51);
            document.text(`Hospital: ${invoice.hospital?.name || "Hospital"}`, 15, 60);
            document.text(`Patient: ${invoice.patient.displayName || invoice.patient.userId}`, 15, 69);
            document.text(`Amount Paid: Rs. ${invoice.total}`, 15, 78);
            document.text(`Payment ID: ${invoice.razorpayPaymentId || "hospital_desk"}`, 15, 87);
            document.text(`Method: ${invoice.paymentMethod || "hospital_desk"}`, 15, 96);
            document.text(`Paid At: ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : new Date().toLocaleString()}`, 15, 105);
            document.addImage(qr, "PNG", 164, 232, 28, 28);
            document.setFontSize(8);
            document.text("Verify receipt", 164, 265);
          },
        });
        return;
      }

      await generatePdf({
        fileName: `${invoice.billNumber}.pdf`,
        title: "Hospital Billing Invoice",
        locale: language,
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
      <h1 className="text-3xl font-bold text-teal-900">Invoice administration (Care Wallet)</h1>
      <p className="mt-2 text-slate-600">
        Create itemized invoices with clinical 0% GST defaults (or admin override) and review live payment settlement status.
      </p>
      {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3 text-sm">{message}</p>}
      {loading && <p role="status" className="mt-4">Loading invoice workflow...</p>}

      {token && (
        <form onSubmit={createInvoice} className="mt-6 space-y-4 rounded-lg border bg-white p-5">
          <h2 className="text-xl font-bold">Create invoice</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Patient Supabase user ID
              <input required className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={patientId} onChange={(event) => setPatientId(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              Patient name (optional)
              <input className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={patientName} onChange={(event) => setPatientName(event.target.value)} />
            </label>
          </div>

          {items.map((item, index) => (
            <fieldset key={index} className="grid gap-3 rounded border p-3 md:grid-cols-4">
              <legend className="px-1 text-xs font-bold">Line item {index + 1}</legend>
              <label className="text-sm font-semibold md:col-span-2">
                Service preset (optional)
                <select
                  className="mt-1 min-h-[40px] w-full rounded border bg-slate-50 px-2 py-1 text-xs"
                  value=""
                  onChange={(e) => applyCatalogPreset(index, e.target.value)}
                >
                  <option value="">Choose from service catalog...</option>
                  {catalog.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} (GST {c.gstRate}%)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold md:col-span-2">
                Description
                <input required className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
              </label>
              <label className="text-sm font-semibold">
                Quantity
                <input required type="number" min="0.01" step="0.01" className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} />
              </label>
              <label className="text-sm font-semibold">
                Unit price (INR)
                <input required type="number" min="0" step="0.01" className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />
              </label>
              <label className="text-sm font-semibold">
                GST %
                <select
                  className="mt-1 min-h-[44px] w-full rounded border px-3 py-2"
                  value={["0", "5", "12", "18"].includes(String(item.taxRate)) ? String(item.taxRate) : "0"}
                  onChange={(event) => updateItem(index, "taxRate", event.target.value)}
                >
                  <option value="0">0% (Clinical default)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
              </label>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((current) => current.filter((_, position) => position !== index))} className="min-h-[44px] self-end rounded border border-red-700 px-3 py-2 text-sm font-bold text-red-900">
                  Remove item
                </button>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="min-h-[44px] rounded border px-3 py-2 text-sm font-semibold">
              Add line item
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={whatsappConsent} onChange={(e) => setWhatsappConsent(e.target.checked)} />
              <span>Patient consented to WhatsApp receipt updates</span>
            </label>
          </div>

          <label className="block max-w-sm text-sm font-semibold">
            Discount (INR)
            <input type="number" min="0" step="0.01" className="mt-1 min-h-[44px] w-full rounded border px-3 py-2" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </label>
          <button disabled={busy} className="min-h-[44px] rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {busy ? "Creating..." : "Create invoice"}
          </button>
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Invoice history</h2>
        <div className="mt-3 space-y-3">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
              <div>
                <h3 className="font-bold">{invoice.billNumber}</h3>
                <p className="text-sm text-slate-600">
                  {invoice.patient.displayName || invoice.patient.userId} · {new Date(invoice.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm">
                  Subtotal {formatCurrency(invoice.subtotal)} · GST {formatCurrency(invoice.tax)} · Discount {formatCurrency(invoice.discount)} ·{" "}
                  <strong>Total {formatCurrency(invoice.total)}</strong>
                </p>
                {invoice.razorpayPaymentId && (
                  <p className="mt-1 text-xs text-green-900">
                    Payment ID: <strong>{invoice.razorpayPaymentId}</strong>
                    {invoice.paymentMethod ? ` · Method: ${invoice.paymentMethod}` : ""}
                    {invoice.paidAt ? ` · Paid ${new Date(invoice.paidAt).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2.5 py-1 text-xs font-bold uppercase ${
                    invoice.paymentStatus === "paid"
                      ? "bg-green-100 text-green-900"
                      : invoice.paymentStatus === "failed"
                        ? "bg-red-100 text-red-900"
                        : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {invoice.paymentStatus}
                </span>
                <button onClick={() => downloadInvoice(invoice, "pdf")} className="min-h-[38px] rounded border px-3 py-1.5 text-sm">
                  PDF
                </button>
                <button onClick={() => downloadInvoice(invoice, "json")} className="min-h-[38px] rounded border px-3 py-1.5 text-sm">
                  JSON
                </button>
                {invoice.paymentStatus === "paid" && (
                  <button onClick={() => downloadInvoice(invoice, "receipt")} className="min-h-[38px] rounded bg-green-800 px-3 py-1.5 text-sm font-bold text-white">
                    Receipt PDF
                  </button>
                )}
                <button onClick={() => setStatus(invoice.id, invoice.paymentStatus === "paid" ? "pending" : "paid")} className="min-h-[38px] rounded border px-3 py-1.5 text-sm">
                  Mark {invoice.paymentStatus === "paid" ? "unpaid" : "paid"}
                </button>
              </div>
            </article>
          ))}
          {!loading && invoices.length === 0 && (
            <p className="rounded border border-dashed p-6 text-slate-600">No invoices have been created for this hospital.</p>
          )}
        </div>
      </section>
    </main>
  );
}
