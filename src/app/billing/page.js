"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { billingSeed } from "../../features/billing/seed";
import { generatePdf } from "../../lib/generatePdf";
import { getSupabaseBrowser } from "../../lib/supabase/browser";

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function BillingPage() {
  const [selected, setSelected] = useState(billingSeed[0]);
  const [anchors, setAnchors] = useState({});
  const [pdfStatus, setPdfStatus] = useState("");
  const [databaseBills, setDatabaseBills] = useState([]);
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let active = true;
    async function loadBills() {
      if (!supabase) return;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const currentUser = sessionData.session?.user || null;
      if (active) setUser(currentUser);
      if (!currentUser) return;
      const response = await fetch("/api/billing", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load invoices.");
      const records = (result.bills || []).map((bill) => ({
        ...bill,
        id: bill.bill_number,
        databaseId: bill.id,
        hospital: bill.hospitals?.name || "Hospital",
        patient: currentUser.user_metadata?.display_name || currentUser.email || "Account holder",
        date: new Date(bill.created_at).toLocaleDateString(),
        paid: bill.payment_status === "paid",
        items: (bill.bill_items || []).map((item) => ({
          name: item.description,
          amount: Number(item.quantity) * Number(item.unit_price),
          taxRate: Number(item.tax_rate),
        })),
      }));
      if (active && records.length) {
        setDatabaseBills(records);
        setSelected(records[0]);
      }
    }
    loadBills().catch((error) => {
      console.error("Could not load Prisma invoices", error);
      if (active) setLoadError("Could not load account bills. Showing clearly marked demo bills.");
    });
    return () => { active = false; };
  }, [supabase]);

  async function anchor(bill) {
    const hash = await sha256(JSON.stringify(bill));
    try {
      const response = await fetch("/api/dhrs/blockchain/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Fabric unavailable");
      const result = await response.json();
      setAnchors((current) => ({ ...current, [bill.id]: { hash, state: "anchored", result } }));
      const entries = JSON.parse(localStorage.getItem("healthx_fabric_entries") || "[]");
      localStorage.setItem("healthx_fabric_entries", JSON.stringify([{ hash, channel: result.channel, blockHeight: result.blockHeight, transactionId: result.transactionId, billId: bill.id }, ...entries]));
    } catch {
      setAnchors((current) => ({ ...current, [bill.id]: { hash, state: "dwn-only" } }));
      const entries = JSON.parse(localStorage.getItem("healthx_fabric_entries") || "[]");
      localStorage.setItem("healthx_fabric_entries", JSON.stringify([{
        hash,
        channel: "dwn-only-demo",
        blockHeight: "not on Fabric",
        transactionId: "DWN-" + bill.id,
        recordId: bill.id,
        demo: true,
      }, ...entries]));
    }
  }

  function download() {
    const text = JSON.stringify(selected, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    try {
      const total = Number(selected.total ?? selected.items.reduce((sum, item) => sum + item.amount * (1 + (item.taxRate || 0) / 100), 0)) - Number(selected.discount || 0);
      let verificationUrl = `${window.location.origin}/billing?bill=${encodeURIComponent(selected.id)}`;
      if (selected.databaseId && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch("/api/billing/verification-link", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
          body: JSON.stringify({ billId: selected.databaseId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not create secure bill verification link.");
        verificationUrl = result.url;
      }
      const qr = await QRCode.toDataURL(verificationUrl);
      await generatePdf({
        fileName: `${selected.id}-billing.pdf`,
        title: "Hospital Billing Invoice",
        watermark: selected.demo === false ? "INVOICE - VERIFY PAYMENT STATUS ONLINE" : "DEMO BILL - NOT FOR OFFICIAL PAYMENT",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setTextColor(30, 41, 59);
          document.setFontSize(11);
          document.text(`Invoice: ${selected.id}`, 15, 38);
          document.text(`Hospital: ${selected.hospital}`, 15, 46);
          document.text(`Patient: ${selected.patient}`, 15, 54);
          document.text(`Date: ${selected.date}`, 15, 62);
          document.text(`Status: ${selected.paid ? "Paid" : "Due"}`, 15, 70);
          if (selected.demo !== false) document.text("DEMO BILL - NOT FOR OFFICIAL PAYMENT", 15, 78);
          document.line(15, 84, 195, 84);
          document.setFont(fontFamily, "bold");
          document.text("Description", 15, 92);
          document.text("Amount (INR)", 195, 92, { align: "right" });
          document.line(15, 96, 195, 96);
          document.setFont(fontFamily, "normal");
          let y = 104;
          selected.items.forEach((item) => {
            document.text(`${item.name}${item.taxRate ? ` (${item.taxRate}% tax)` : ""}`, 15, y);
            document.text(`Rs. ${item.amount}`, 195, y, { align: "right" });
            y += 9;
          });
          document.line(15, y + 2, 195, y + 2);
          if (selected.subtotal != null) document.text(`Subtotal: Rs. ${selected.subtotal}`, 195, y + 10, { align: "right" });
          if (selected.tax != null) document.text(`Tax: Rs. ${selected.tax}`, 195, y + 18, { align: "right" });
          if (selected.discount) document.text(`Discount: Rs. ${selected.discount}`, 195, y + 26, { align: "right" });
          document.setFont(fontFamily, "bold");
          document.text(`Total: Rs. ${total}`, 195, y + 34, { align: "right" });
          document.addImage(qr, "PNG", 164, 232, 28, 28);
          document.setFont(fontFamily, "normal");
          document.setFontSize(8);
          document.text("Bill verification", 164, 264);
          if (recordAnchor) {
            document.text("DWN SHA-256:", 15, y + 24);
            document.text(recordAnchor.hash, 15, y + 30, { maxWidth: 140 });
          }
        },
      });
      setPdfStatus(`PDF generated: ${selected.id}-billing.pdf`);
    } catch (error) {
      console.error("Could not generate billing PDF", error);
      setPdfStatus("Could not generate the PDF. Please try again.");
    }
  }

  async function payBill() {
    if (!selected.databaseId || selected.demo) {
      setPaymentStatus("Razorpay is available only for authenticated, pre-created account invoices.");
      return;
    }
    setPaymentBusy(true);
    setPaymentStatus("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` };
      const orderResponse = await fetch("/api/billing/create-order", {
        method: "POST",
        headers,
        body: JSON.stringify({ billId: selected.databaseId }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not create payment order.");
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded."));
          document.body.appendChild(script);
        });
      }
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Swasth Saathi",
        description: `Bill ${selected.id}`,
        handler: async (result) => {
          const verificationResponse = await fetch("/api/billing/verify-payment", {
            method: "POST",
            headers,
            body: JSON.stringify({
              billId: selected.databaseId,
              orderId: result.razorpay_order_id,
              paymentId: result.razorpay_payment_id,
              signature: result.razorpay_signature,
            }),
          });
          const verification = await verificationResponse.json();
          if (!verificationResponse.ok) {
            setPaymentStatus(verification.error || "Payment verification failed.");
            return;
          }
          setSelected((current) => ({ ...current, payment_status: "paid", paid: true }));
          setDatabaseBills((current) => current.map((bill) => bill.databaseId === selected.databaseId ? { ...bill, payment_status: "paid", paid: true } : bill));
          setPaymentStatus("TEST payment verified and bill marked paid.");
        },
        modal: { ondismiss: () => setPaymentStatus("Payment window closed. Bill remains unpaid.") },
      });
      checkout.on("payment.failed", (failure) => {
        console.error("Razorpay checkout failed", failure.error);
        setPaymentStatus("Payment failed. The bill remains unpaid.");
      });
      checkout.open();
    } catch (error) {
      console.error("Could not start Razorpay payment", error);
      setPaymentStatus(error.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  const total = Number(selected.total ?? selected.items.reduce((sum, item) => sum + item.amount * (1 + (item.taxRate || 0) / 100), 0)) - Number(selected.discount || 0);
  const recordAnchor = anchors[selected.id];
  const allBills = [...databaseBills, ...billingSeed];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Billing</h1>
      <p className="mt-2 text-slate-600">{databaseBills.length ? "Account invoices from Prisma Postgres plus clearly labeled demo invoices." : "Demo bills; account invoices and Razorpay TEST payment require setup."}</p>
      {loadError && <p role="status" className="mt-3 rounded bg-amber-50 p-3">{loadError}</p>}
      {supabase && !user && <p className="mt-3 rounded bg-amber-50 p-3">Sign in to view and pay account bills. <a className="underline" href="/auth">Sign in</a></p>}
      <div className="mt-6 grid gap-6 md:grid-cols-[300px_1fr]">
        <section className="space-y-2">
          {allBills.map((bill) => (
            <button key={bill.id} onClick={() => setSelected(bill)} className={`w-full rounded border p-3 text-left ${selected.id === bill.id ? "border-teal-800 bg-teal-50" : "bg-white"}`}>
              <strong>{bill.id}</strong><span className="mt-1 block text-sm">{bill.hospital}</span>
              <span className="text-xs text-slate-600">{bill.demo === false ? "ACCOUNT BILL" : "DEMO"} · {bill.paid ? "Paid" : "Due"}</span>
            </button>
          ))}
        </section>
        <section className="rounded-lg border bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div><h2 className="text-xl font-bold">{selected.id}</h2><p className="text-sm text-slate-600">{selected.hospital} · {selected.date}</p></div>
            <span className={`h-fit rounded px-2 py-1 text-xs font-bold ${recordAnchor?.state === "anchored" ? "bg-green-100 text-green-900" : recordAnchor ? "bg-green-100 text-green-900" : "bg-green-100 text-green-900"}`}>
              {recordAnchor?.state === "anchored" ? "LIVE DEMO · ATTESTED" : recordAnchor ? "LIVE DEMO · DWN LEDGER" : "LIVE DEMO · DWN LEDGER"}
            </span>
          </div>
          <table className="mt-5 w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Item</th><th className="py-2">GST</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>{selected.items.map((item) => <tr key={item.name} className="border-b"><td className="py-2">{item.name}</td><td className="py-2">{item.taxRate ? `${item.taxRate}%` : "—"}</td><td className="py-2 text-right">₹{item.amount}</td></tr>)}</tbody>
          </table>
          {selected.subtotal != null && <p className="mt-3 text-right text-sm">Subtotal: ₹{selected.subtotal} · GST/Tax: ₹{selected.tax || 0} · Discount: ₹{selected.discount || 0}</p>}
          <p className="mt-3 text-right text-lg font-bold">Total: ₹{total}</p>
          {recordAnchor && <p className="mt-3 break-all rounded bg-slate-50 p-2 text-xs"><strong>SHA-256:</strong> {recordAnchor.hash}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={downloadPdf} className="rounded bg-teal-800 px-4 py-2 font-semibold text-white">Download PDF</button>
            <button onClick={download} className="rounded border border-teal-800 px-4 py-2 text-teal-900">Download JSON</button>
            {selected.databaseId && selected.payment_status === "pending" && <button disabled={paymentBusy} onClick={payBill} className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-60">{paymentBusy ? "Starting payment..." : "Pay with Razorpay TEST"}</button>}
            <button onClick={() => anchor(selected)} className="rounded bg-teal-800 px-4 py-2 text-white">Anchor optional record hash</button>
          </div>
          {pdfStatus && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-900">{pdfStatus}</p>}
          {paymentStatus && <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-sm">{paymentStatus}</p>}
        </section>
      </div>
    </div>
  );
}
