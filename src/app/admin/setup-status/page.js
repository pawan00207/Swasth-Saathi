"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetupStatusPage() {
  const [integrations, setIntegrations] = useState([]);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [testError, setTestError] = useState("");

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

  const summary = integrations.reduce((counts, integration) => {
    const state = integration.ok ? "live" : integration.configured ? "unavailable" : "demo";
    counts[state] += 1;
    return counts;
  }, { live: 0, unavailable: 0, demo: 0 });

  return (
    <div className="site-container py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>Integration setup status</h1>
          <p className="mt-2 text-slate-700">See which services have credentials and whether their checks passed. Secret values stay on the server.</p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={loading} className="gap-2">
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
          {loading ? "Checking…" : "Check again"}
        </Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">{error}</p>}
      <section className="mt-6" aria-labelledby="provider-checks-title" aria-busy={loading}>
        <h2 id="provider-checks-title" className="sr-only">Provider checks</h2>
        {loading && integrations.length === 0 && <p role="status" className="site-panel">Checking integrations…</p>}
        {integrations.length > 0 && (
          <>
            <dl className="setup-summary">
              {[
                ["Live", summary.live],
                ["Not configured", summary.demo],
                ["Check failed", summary.unavailable],
              ].map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            <div className="setup-table">
              <table className="w-full text-left text-sm">
                <thead><tr><th scope="col">Service</th><th scope="col">Keys</th><th scope="col">Live check</th></tr></thead>
                <tbody>
                  {integrations.map((integration) => {
                    const state = integration.ok ? "live" : integration.configured ? "unavailable" : "demo";
                    return (
                      <tr key={integration.name}>
                        <th scope="row">{integration.name}</th>
                        <td>{integration.configured ? "Present" : "Missing"}</td>
                        <td>
                          <span className="provider-state" data-state={state}>
                            {integration.ok ? "Passed" : integration.configured ? "Failed or unavailable" : "Not run"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="site-panel mt-8" aria-labelledby="whatsapp-test-title">
        <h2 id="whatsapp-test-title" className="text-xl font-semibold">Send a WhatsApp test</h2>
        <p className="mt-2 text-sm text-slate-700">Send a test alert through your configured Twilio Sandbox or Meta Cloud API provider.</p>
        <form onSubmit={sendTestWhatsapp} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid w-full gap-2 sm:max-w-xs">
            <Label htmlFor="whatsapp-test-phone">Recipient number</Label>
            <Input id="whatsapp-test-phone" required type="tel" placeholder="+91" autoComplete="tel"
              aria-describedby="whatsapp-test-hint" value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)} />
          </div>
          <Button type="submit" disabled={testBusy} className="gap-2">
            <Send size={16} strokeWidth={1.5} aria-hidden="true" />
            {testBusy ? "Sending…" : "Send test message"}
          </Button>
        </form>
        <p id="whatsapp-test-hint" className="mt-2 text-sm text-slate-600">Include the country code.</p>
        {testStatus && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-950">{testStatus}</p>}
        {testError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-950">{testError}</p>}
      </section>

      {checkedAt && (
        <p className="mt-4 text-sm text-slate-600">Last checked <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleString()}</time></p>
      )}
    </div>
  );
}
