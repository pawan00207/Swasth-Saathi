"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Building2, CheckCircle2, FileText, Landmark, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { billingSeed } from "../../features/billing/seed";
import schemesSeed from "../../features/schemes/data/schemes.json";
import { explainSchemeMatch } from "../../features/schemes/eligibility";
import { generatePdf } from "../../lib/generatePdf";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import { DEFAULT_SERVICE_CATALOG, explainLineItem } from "../../lib/service-catalog";
import { useI18n } from "../../components/I18nProvider";

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function computeBillTotal(bill) {
  if (bill.total != null) return Number(bill.total);
  const raw = (bill.items || []).reduce(
    (sum, item) => sum + Number(item.amount || 0) * (1 + Number(item.taxRate || 0) / 100),
    0,
  );
  return Math.max(0, raw - Number(bill.discount || 0));
}

function loadRazorpayCheckout() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded."));
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const { language, t, formatCurrency, formatDate } = useI18n();
  const [selected, setSelected] = useState(billingSeed[0]);
  const [anchors, setAnchors] = useState({});
  const [pdfStatus, setPdfStatus] = useState("");
  const [databaseBills, setDatabaseBills] = useState([]);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState(DEFAULT_SERVICE_CATALOG);
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [schemePanelOpen, setSchemePanelOpen] = useState(true);
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    fetch("/api/service-catalog", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items?.length) setServiceCatalog(data.items);
      })
      .catch(() => {});
  }, []);

  const loadBills = useCallback(async () => {
    if (!supabase) return;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const currentUser = sessionData.session?.user || null;
    setUser(currentUser);
    if (!currentUser) return;
    const response = await fetch("/api/billing", {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load invoices.");
    setRazorpayConfigured(Boolean(result.razorpayConfigured));
    const records = (result.bills || []).map((bill) => ({
      ...bill,
      id: bill.bill_number,
      databaseId: bill.id,
      hospital: bill.hospitals?.name || "Hospital",
      patient: currentUser.user_metadata?.display_name || currentUser.email || "Account holder",
      date: bill.created_at,
      paid: bill.payment_status === "paid",
      items: (bill.bill_items || []).map((item) => ({
        name: item.description,
        amount: Number(item.quantity) * Number(item.unit_price),
        taxRate: Number(item.tax_rate || 0),
      })),
    }));
    setDatabaseBills(records);
    setSelected((prev) => {
      if (!records.length) return prev;
      const updatedMatch = records.find((r) => r.databaseId === prev?.databaseId);
      return updatedMatch || (prev?.databaseId ? records[0] : records[0]);
    });
  }, [supabase]);

  useEffect(() => {
    loadBills().catch((error) => {
      console.error("Could not load Prisma invoices", error);
      setLoadError("Could not load account bills. Showing clearly marked demo bills.");
    });
  }, [loadBills]);

  useRealtimeRefresh(
    selected?.databaseId ? [{ name: `billing-invoice-${selected.databaseId}`, private: true }] : [],
    loadBills,
    15000,
  );

  const normalizedSeedBills = useMemo(
    () =>
      billingSeed.map((b) => ({
        ...b,
        payment_status: b.paid ? "paid" : "pending",
        items: b.items.map((it) => ({ ...it, taxRate: it.taxRate ?? (it.name === "GST" ? 18 : 0) })),
      })),
    [],
  );

  const allBills = useMemo(
    () => [...databaseBills, ...normalizedSeedBills],
    [databaseBills, normalizedSeedBills],
  );

  // Summary analytics computed from authenticated DB bills if present, else demo fallback bills
  const analyticsSource = databaseBills.length > 0 ? databaseBills : normalizedSeedBills;
  const usingDemoAnalytics = databaseBills.length === 0;

  const summary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let totalYear = 0;
    let totalPaid = 0;
    let totalDue = 0;
    const hospitalTotals = new Map();
    const monthlyTotals = new Map();

    for (const bill of analyticsSource) {
      const amount = computeBillTotal(bill);
      const d = new Date(bill.date);
      const year = Number.isNaN(d.getTime()) ? currentYear : d.getFullYear();
      if (year === currentYear || analyticsSource === normalizedSeedBills) {
        totalYear += amount;
      }
      if (bill.paid || bill.payment_status === "paid") totalPaid += amount;
      else totalDue += amount;

      const hosp = bill.hospital || "Hospital";
      hospitalTotals.set(hosp, (hospitalTotals.get(hosp) || 0) + amount);

      const monthKey = Number.isNaN(d.getTime())
        ? "Unknown"
        : d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount);
    }

    const hospitalSplit = [...hospitalTotals.entries()].sort((a, b) => b[1] - a[1]);
    const monthlyChart = [...monthlyTotals.entries()];
    const maxMonth = Math.max(1, ...monthlyChart.map(([, val]) => val));

    return {
      totalYear,
      totalPaid,
      totalDue,
      hospitalsVisited: hospitalTotals.size,
      hospitalSplit,
      monthlyChart,
      maxMonth,
    };
  }, [analyticsSource, normalizedSeedBills]);

  // Matched government schemes & estimate savings
  const matchedSchemes = useMemo(() => {
    let savedProfile = { state: "All", income: "250000", occupation: "All", gender: "All" };
    try {
      const stored = JSON.parse(localStorage.getItem("swasth_scheme_profile") || "null");
      if (stored) savedProfile = { ...savedProfile, ...stored };
    } catch {
      // Use defaults
    }
    return schemesSeed
      .filter((scheme) => scheme.category === "Healthcare" || scheme.category === "Disability")
      .map((scheme) => ({
        scheme,
        match: explainSchemeMatch(scheme, savedProfile),
      }))
      .slice(0, 4);
  }, []);

  const estimatedSchemeSavings = useMemo(() => {
    const eligibleCount = matchedSchemes.filter((m) => m.match.status === "eligible" || m.match.status === "likely").length;
    if (!eligibleCount || summary.totalYear <= 0) return 0;
    return Math.round(summary.totalYear * 0.4);
  }, [matchedSchemes, summary.totalYear]);

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
      localStorage.setItem(
        "healthx_fabric_entries",
        JSON.stringify([{ hash, channel: result.channel, blockHeight: result.blockHeight, transactionId: result.transactionId, billId: bill.id }, ...entries]),
      );
    } catch {
      setAnchors((current) => ({ ...current, [bill.id]: { hash, state: "dwn-only" } }));
      const entries = JSON.parse(localStorage.getItem("healthx_fabric_entries") || "[]");
      localStorage.setItem(
        "healthx_fabric_entries",
        JSON.stringify([{
          hash,
          channel: "dwn-only-demo",
          blockHeight: "not on Fabric",
          transactionId: "DWN-" + bill.id,
          recordId: bill.id,
          demo: true,
        }, ...entries]),
      );
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

  async function getVerificationUrl(bill) {
    let verificationUrl = `${window.location.origin}/verify/demo-${encodeURIComponent(bill.id)}`;
    if (bill.databaseId && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/billing/verification-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        },
        body: JSON.stringify({ billId: bill.databaseId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create secure bill verification link.");
      verificationUrl = result.url;
    }
    return verificationUrl;
  }

  async function downloadPdf() {
    try {
      const total = computeBillTotal(selected);
      const verificationUrl = await getVerificationUrl(selected);
      const qr = await QRCode.toDataURL(verificationUrl);
      await generatePdf({
        fileName: `${selected.id}-billing.pdf`,
        title: "Care Wallet Invoice",
        locale: language,
        watermark: selected.demo === false ? "INVOICE - VERIFY INTEGRITY ONLINE" : "DEMO BILL - NOT FOR OFFICIAL PAYMENT",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setTextColor(30, 41, 59);
          document.setFontSize(11);
          document.text(`Invoice: ${selected.id}`, 15, 38);
          document.text(`Hospital: ${selected.hospital}`, 15, 46);
          document.text(`Patient: ${selected.patient}`, 15, 54);
          document.text(`Date: ${formatDate(selected.date)}`, 15, 62);
          document.text(`Status: ${selected.paid ? "Paid" : selected.payment_status || "Due"}`, 15, 70);
          if (selected.demo !== false) document.text("DEMO BILL - NOT FOR OFFICIAL PAYMENT", 15, 78);
          document.line(15, 84, 195, 84);
          document.setFont(fontFamily, "bold");
          document.text("Description", 15, 92);
          document.text("GST %", 142, 92, { align: "right" });
          document.text("Amount (INR)", 195, 92, { align: "right" });
          document.line(15, 96, 195, 96);
          document.setFont(fontFamily, "normal");
          let y = 104;
          selected.items.forEach((item) => {
            document.text(`${item.name}`, 15, y, { maxWidth: 112 });
            document.text(`${item.taxRate ?? 0}%`, 142, y, { align: "right" });
            document.text(`Rs. ${item.amount}`, 195, y, { align: "right" });
            y += 9;
          });
          document.line(15, y + 2, 195, y + 2);
          if (selected.subtotal != null) document.text(`Subtotal: Rs. ${selected.subtotal}`, 195, y + 10, { align: "right" });
          if (selected.tax != null) document.text(`GST: Rs. ${selected.tax}`, 195, y + 18, { align: "right" });
          if (selected.discount) document.text(`Discount: Rs. ${selected.discount}`, 195, y + 26, { align: "right" });
          document.setFont(fontFamily, "bold");
          document.text(`Total: Rs. ${total}`, 195, y + 34, { align: "right" });
          document.addImage(qr, "PNG", 164, 232, 28, 28);
          document.setFont(fontFamily, "normal");
          document.setFontSize(8);
          document.text("Verify bill QR", 164, 264);
          if (recordAnchor) {
            document.text("Trust Seal SHA-256:", 15, y + 24);
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

  async function downloadReceiptPdf() {
    try {
      const total = computeBillTotal(selected);
      const verificationUrl = await getVerificationUrl(selected);
      const qr = await QRCode.toDataURL(verificationUrl);
      const receiptNo = `RCP-${selected.id}`;
      const paymentId = selected.razorpay_payment_id || (selected.demo !== false ? `DEMO-PAY-${selected.id}` : "Settled");
      const paidWhen = selected.paid_at ? new Date(selected.paid_at).toLocaleString() : new Date().toLocaleString();
      const method = selected.payment_method || "Razorpay";

      await generatePdf({
        fileName: `${receiptNo}.pdf`,
        title: "Payment Receipt (Care Wallet)",
        locale: language,
        watermark: selected.demo === false ? "OFFICIAL PAYMENT RECEIPT" : "DEMO RECEIPT - TEST RECORD",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setTextColor(15, 118, 110);
          document.setFontSize(18);
          document.text("PAID", 185, 42, { align: "right" });
          document.setDrawColor(15, 118, 110);
          document.rect(160, 33, 30, 12);

          document.setTextColor(30, 41, 59);
          document.setFontSize(11);
          document.text(`Receipt No: ${receiptNo}`, 15, 40);
          document.text(`Invoice No: ${selected.id}`, 15, 49);
          document.text(`Hospital: ${selected.hospital}`, 15, 58);
          document.text(`Patient: ${selected.patient}`, 15, 67);
          document.text(`Amount Paid: Rs. ${total}`, 15, 76);
          document.text(`Payment ID: ${paymentId}`, 15, 85);
          document.text(`Payment Method: ${method}`, 15, 94);
          document.text(`Paid At: ${paidWhen}`, 15, 103);

          document.addImage(qr, "PNG", 162, 228, 30, 30);
          document.setFontSize(8);
          document.text("Scan to verify invoice", 160, 263);
        },
      });
      setPdfStatus(`Receipt PDF generated: ${receiptNo}.pdf`);
    } catch (error) {
      console.error("Could not generate receipt PDF", error);
      setPdfStatus("Could not generate the receipt PDF.");
    }
  }

  async function payBill({ isDemoBill = false } = {}) {
    setPaymentBusy(true);
    setPaymentStatus("");
    try {
      const headers = { "Content-Type": "application/json" };
      if (!isDemoBill) {
        const { data: sessionData } = await supabase.auth.getSession();
        headers.Authorization = `Bearer ${sessionData.session?.access_token || ""}`;
      }

      const payload = isDemoBill
        ? { demoBill: { id: selected.id, total: computeBillTotal(selected) } }
        : { billId: selected.databaseId };

      const orderResponse = await fetch("/api/billing/create-order", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not create payment order.");

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Swasth Saathi Care Wallet",
        description: `${isDemoBill ? "TEST DEMO " : ""}Bill ${selected.id}`,
        handler: async (result) => {
          if (isDemoBill) {
            setSelected((curr) => ({
              ...curr,
              paid: true,
              payment_status: "paid",
              razorpay_payment_id: result.razorpay_payment_id,
              payment_method: "razorpay_test",
              paid_at: new Date().toISOString(),
            }));
            setPaymentStatus("Razorpay TEST demo payment completed.");
            return;
          }
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
          await loadBills();
          setPaymentStatus("Payment verified and invoice settled.");
        },
        modal: {
          ondismiss: () => setPaymentStatus("Payment window closed. Invoice status unchanged."),
        },
      });
      checkout.on("payment.failed", (failure) => {
        console.error("Razorpay checkout failed", failure.error);
        setPaymentStatus("Payment failed. You can retry payment anytime.");
      });
      checkout.open();
    } catch (error) {
      console.error("Could not start Razorpay payment", error);
      setPaymentStatus(error.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  const total = computeBillTotal(selected);
  const recordAnchor = anchors[selected.id];
  const statusKey = selected.payment_status || (selected.paid ? "paid" : "pending");
  const isPaid = statusKey === "paid" || selected.paid;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-teal-900">
            <Wallet className="h-7 w-7" aria-hidden="true" />
            <span>{t("wallet.title")}</span>
          </h1>
          <p className="mt-2 text-slate-600">{t("wallet.subtitle")}</p>
        </div>
        {usingDemoAnalytics && (
          <span className="rounded-md bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-950">
            DEMO SUMMARY · Connect Supabase/Prisma for live account analytics
          </span>
        )}
      </div>

      {loadError && <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-sm">{loadError}</p>}
      {supabase && !user && (
        <p className="mt-3 rounded bg-amber-50 p-3 text-sm">
          Sign in to view and pay account bills. <a className="font-bold underline" href="/auth">Sign in</a>
        </p>
      )}

      {/* Summary Cards */}
      <section aria-label="Care Wallet Summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-600">{t("wallet.totalSpentYear")}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(summary.totalYear)}</p>
          {usingDemoAnalytics && <span className="mt-1 inline-block text-xs font-bold text-amber-800">DEMO</span>}
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-600">{t("wallet.paidVsDue")}</p>
          <p className="mt-2 text-lg font-extrabold text-green-800">Paid: {formatCurrency(summary.totalPaid)}</p>
          <p className="text-sm font-bold text-amber-900">Due: {formatCurrency(summary.totalDue)}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-600">{t("wallet.hospitalsVisited")}</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-950">
            <Building2 className="h-5 w-5 text-teal-800" aria-hidden="true" />
            <span>{summary.hospitalsVisited}</span>
          </p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase text-slate-600">{t("wallet.estimatedSavings")}</p>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-950">
              {t("wallet.schemeEstimateBadge")}
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-teal-900">{formatCurrency(estimatedSchemeSavings)}</p>
        </article>
      </section>

      {/* Monthly chart & Hospital Split */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-bold text-slate-950">{t("wallet.monthlyChart")}</h2>
          <div className="mt-4 space-y-3">
            {summary.monthlyChart.map(([month, amount]) => (
              <div key={month}>
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{month}</span>
                  <span>{formatCurrency(amount)}</span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-700"
                    style={{ width: `${Math.max(8, Math.round((amount / summary.maxMonth) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-bold text-slate-950">{t("wallet.hospitalSplit")}</h2>
          <div className="mt-4 space-y-2 text-sm">
            {summary.hospitalSplit.map(([hosp, amount]) => (
              <div key={hosp} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-800">{hosp}</span>
                <span className="font-bold text-slate-950">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Invoice List + Detail */}
      <div className="mt-6 grid gap-6 md:grid-cols-[310px_1fr]">
        <section className="space-y-2" aria-label="Invoices">
          {allBills.map((bill) => {
            const billTotal = computeBillTotal(bill);
            const st = bill.payment_status || (bill.paid ? "paid" : "pending");
            return (
              <button
                key={bill.id}
                onClick={() => setSelected(bill)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selected.id === bill.id ? "border-teal-800 bg-teal-50 ring-2 ring-teal-700" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{bill.id}</strong>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                      st === "paid"
                        ? "bg-green-100 text-green-900"
                        : st === "failed"
                          ? "bg-red-100 text-red-900"
                          : st === "processing"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {t(`wallet.status.${st}`)}
                  </span>
                </div>
                <span className="mt-1 block text-sm text-slate-800">{bill.hospital}</span>
                <span className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{bill.demo === false ? "ACCOUNT BILL" : "DEMO"}</span>
                  <strong className="text-slate-900">{formatCurrency(billTotal)}</strong>
                </span>
              </button>
            );
          })}
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">{selected.id}</h2>
              <p className="text-sm text-slate-600">
                {selected.hospital} · {formatDate(selected.date)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2.5 py-1 text-xs font-bold uppercase ${
                  isPaid
                    ? "bg-green-100 text-green-900"
                    : statusKey === "failed"
                      ? "bg-red-100 text-red-900"
                      : statusKey === "processing"
                        ? "bg-blue-100 text-blue-900"
                        : "bg-amber-100 text-amber-950"
                }`}
              >
                {t(`wallet.status.${statusKey}`)}
              </span>
              {recordAnchor && (
                <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2.5 py-1 text-xs font-extrabold text-green-900">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("wallet.trustSealed")}</span>
                </span>
              )}
              <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
                {selected.demo === false ? "VERIFIED INVOICE" : "DEMO BILL"}
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-700">
                  <th className="py-2">{t("wallet.itemColumn")} &amp; {t("wallet.billClarity")}</th>
                  <th className="py-2">{t("wallet.gstColumn")}</th>
                  <th className="py-2 text-right">{t("wallet.amountColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => {
                  const clarity = explainLineItem(item.name, serviceCatalog, language);
                  return (
                    <tr key={`${item.name}-${idx}`} className="border-b align-top">
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-slate-950">{item.name}</p>
                        {clarity && clarity !== item.name && (
                          <p className="mt-0.5 text-xs text-slate-600">{clarity}</p>
                        )}
                      </td>
                      <td className="py-2.5">{item.taxRate != null ? `${item.taxRate}%` : "0%"}</td>
                      <td className="py-2.5 text-right font-semibold">{formatCurrency(item.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected.subtotal != null && (
            <p className="mt-3 text-right text-sm text-slate-700">
              Subtotal: {formatCurrency(selected.subtotal)} · GST: {formatCurrency(selected.tax || 0)} · Discount: {formatCurrency(selected.discount || 0)}
            </p>
          )}
          <p className="mt-2 text-right text-xl font-extrabold text-slate-950">
            Total: {formatCurrency(total)}
          </p>

          {selected.razorpay_payment_id && (
            <p className="mt-2 text-right text-xs text-green-900">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Payment ID: <strong>{selected.razorpay_payment_id}</strong>
              {selected.payment_method ? ` (${selected.payment_method})` : ""}
            </p>
          )}

          {/* Trust Seal box */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-bold text-slate-900">
              {t("wallet.trustSeal")}: {recordAnchor ? t("wallet.trustSealed") : "Optional tamper-evident hash seal"}
            </p>
            {recordAnchor && <p className="mt-1 break-all text-slate-700"><strong>SHA-256:</strong> {recordAnchor.hash}</p>}
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={downloadPdf}
              className="min-h-[44px] rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900"
            >
              {t("wallet.downloadPdf")}
            </button>
            <button
              onClick={download}
              className="min-h-[44px] rounded-lg border border-teal-800 px-4 py-2 text-sm font-bold text-teal-900 hover:bg-teal-50"
            >
              {t("wallet.downloadJson")}
            </button>

            {isPaid && (
              <button
                onClick={downloadReceiptPdf}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-green-800 px-4 py-2 text-sm font-bold text-white hover:bg-green-900"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>{t("wallet.downloadReceipt")}</span>
              </button>
            )}

            {selected.databaseId && ["pending", "failed", "processing"].includes(statusKey) && (
              <button
                disabled={paymentBusy}
                onClick={() => payBill({ isDemoBill: false })}
                className="min-h-[44px] rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
              >
                {paymentBusy
                  ? "Starting payment..."
                  : statusKey === "failed"
                    ? t("wallet.retryPayment")
                    : t("wallet.payNow")}
              </button>
            )}

            {!selected.databaseId && !isPaid && (
              razorpayConfigured ? (
                <button
                  disabled={paymentBusy}
                  onClick={() => payBill({ isDemoBill: true })}
                  className="min-h-[44px] rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-60"
                >
                  {paymentBusy ? "Starting..." : t("wallet.testPayment")}
                </button>
              ) : (
                <span className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
                  {t("wallet.keysNotConfigured")}
                </span>
              )
            )}

            <button
              onClick={() => anchor(selected)}
              className="min-h-[44px] rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900"
            >
              {t("wallet.anchorHash")}
            </button>
          </div>

          {pdfStatus && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-900">{pdfStatus}</p>}
          {paymentStatus && <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-950">{paymentStatus}</p>}

          {/* Could a scheme help? */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-900" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-950">{t("wallet.schemeHelpTitle")}</h3>
                <span className="rounded bg-blue-200 px-2 py-0.5 text-[11px] font-extrabold text-blue-950">
                  {t("wallet.schemeEstimateBadge")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSchemePanelOpen((v) => !v)}
                className="text-xs font-bold text-blue-900 underline"
              >
                {schemePanelOpen ? "Hide" : "Show"}
              </button>
            </div>
            {schemePanelOpen && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-blue-950">{t("wallet.schemeDisclaimer")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {matchedSchemes.map(({ scheme, match }) => (
                    <div key={scheme.id} className="rounded-lg border border-blue-200 bg-white p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-slate-950">{scheme.name}</strong>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-bold uppercase text-blue-950">
                          {match.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700">{scheme.benefit}</p>
                      <p className="mt-1 text-slate-600">{match.reason}</p>
                    </div>
                  ))}
                </div>
                <a href="/schemes" className="inline-flex items-center gap-1 text-xs font-bold text-teal-900 underline">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Check full eligibility in Schemes</span>
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
