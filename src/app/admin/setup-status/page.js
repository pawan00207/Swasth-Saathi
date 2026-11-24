"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { ensureSupabaseBrowser } from "../../../lib/supabase/browser";

export default function SetupStatusPage() {
  const [integrations, setIntegrations] = useState([]);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [testError, setTestError] = useState("");

  const [tgType, setTgType] = useState("bed_request");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgStatus, setTgStatus] = useState("");
  const [tgError, setTgError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/setup-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not check integration status.");
      setIntegrations(result.integrations || []);
      setCheckedAt(result.checkedAt || "");
    } catch (reason) {
      setError(reason.message || "Could not check integration status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendTestWhatsapp(event) {
    event.preventDefault();
    setTestBusy(true);
    setTestStatus("");
    setTestError("");
    try {
      const response = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testPhone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send test WhatsApp message.");
      setTestStatus(`Test message sent via ${result.provider} to ${result.recipientMask} (status: ${result.status}).`);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestBusy(false);
    }
  }

  async function sendTestTelegram(event) {
    event.preventDefault();
    setTgBusy(true);
    setTgStatus("");
    setTgError("");
    try {
      const supabase = await ensureSupabaseBrowser();
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!data.session?.access_token) {
        throw new Error("Sign in as an authorized administrator on /auth to run Telegram test alerts.");
      }
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ type: tgType }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send test Telegram notification.");
      setTgStatus(`Telegram ${result.type} test sent to ${result.recipientMask} (status: ${result.status}).`);
    } catch (err) {
      setTgError(err.message);
    } finally {
      setTgBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-teal-900">Integration setup status</h1>
          <p className="mt-2 text-slate-600">
            Only configuration and connectivity status are shown. Secret values are never sent to this page.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="min-h-[44px] rounded border border-teal-800 px-4 py-2 font-semibold text-teal-900 disabled:opacity-60"
        >
          {loading ? "Checking..." : "Check again"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-900">{error}</p>}
      {loading && integrations.length === 0 && <p role="status" className="mt-5">Testing integrations...</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {integrations.map((integration) => (
          <article key={integration.name} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold">{integration.name}</h2>
              <span
                className={`rounded px-2 py-1 text-xs font-bold ${
                  integration.ok
                    ? "bg-green-100 text-green-900"
                    : integration.configured
                      ? "bg-red-100 text-red-900"
                      : "bg-amber-100 text-amber-950"
                }`}
              >
                {integration.ok ? "LIVE · OK" : integration.configured ? "CONFIGURED · CHECK NETWORK" : "CACHED SNAPSHOT"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Environment keys: {integration.configured ? "present" : "missing"}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Live test: {integration.ok ? "succeeded" : integration.configured ? "failed or unavailable" : "not run"}
            </p>
          </article>
        ))}
      </div>

      {/* WhatsApp Test Trigger */}
      <section className="mt-8 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">Send test WhatsApp</h2>
        <p className="mt-1 text-sm text-slate-600">
          Verify your configured WhatsApp provider (Twilio Sandbox or Meta Cloud API) by sending a test alert.
        </p>
        <form onSubmit={sendTestWhatsapp} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Recipient WhatsApp number (with country code)
            <input
              required
              type="tel"
              placeholder="+919876543210"
              className="mt-1 block min-h-[44px] w-64 rounded border border-slate-400 px-3 py-2"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={testBusy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-teal-800 px-4 py-2 font-bold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{testBusy ? "Sending..." : "Send test WhatsApp"}</span>
          </button>
        </form>
        {testStatus && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm font-semibold text-green-950">{testStatus}</p>}
        {testError && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm font-semibold text-red-950">{testError}</p>}
      </section>

      {/* Telegram Admin Test Trigger */}
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">Send test Telegram alert (Authorized Admins)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Verify Telegram Bot API notifications for Hospital Bed Requests and Emergency SOS alerts. Requires administrator sign-in.
        </p>
        <form onSubmit={sendTestTelegram} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Notification type
            <select
              className="mt-1 block min-h-[44px] w-64 rounded border border-slate-400 bg-white px-3 py-2"
              value={tgType}
              onChange={(e) => setTgType(e.target.value)}
            >
              <option value="bed_request">Bed Request Notification</option>
              <option value="sos">SOS Emergency Alert</option>
              <option value="ping">Bot Connection Ping</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={tgBusy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-teal-800 px-4 py-2 font-bold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{tgBusy ? "Sending..." : "Send test Telegram"}</span>
          </button>
        </form>
        {tgStatus && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm font-semibold text-green-950">{tgStatus}</p>}
        {tgError && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm font-semibold text-red-950">{tgError}</p>}
      </section>

      {checkedAt && (
        <p className="mt-4 text-sm text-slate-500">Last checked: {new Date(checkedAt).toLocaleString()}</p>
      )}
    </main>
  );
}
