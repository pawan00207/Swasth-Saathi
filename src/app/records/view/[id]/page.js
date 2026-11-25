"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensureSupabaseBrowser } from "../../../../lib/supabase/browser";

export default function PatientRecordPage({ params }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    async function readReport() {
      const client = await ensureSupabaseBrowser();
      const session = client && (await client.auth.getSession()).data.session;
      if (!session) throw new Error("Sign in as the report owner, or open the share link you received.");
      const response = await fetch("/api/reports/download/" + encodeURIComponent(params.id) + "?format=json", {
        headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("This report could not be opened with your account.");
      const { report } = await response.json();
      if (!controller.signal.aborted) setResult({ id: params.id, report });
    }
    readReport().catch(error => {
      if (!controller.signal.aborted) setResult({ id: params.id, error: error.message });
    });
    return () => controller.abort();
  }, [params.id]);
  const current = result?.id === params.id ? result : null;
  return (
    <div className="site-container py-8">
      <h1>Medical report</h1>
      <section className="site-panel mt-5">
        {current?.report ? (
          <><h2 className="text-xl font-semibold">{current.report.reportType}</h2>
            <p>{current.report.patientName} · {current.report.reportDate}</p>
            <p className="whitespace-pre-wrap">{current.report.notes}</p></>
        ) : <p role="status">{current?.error || "Loading report…"}</p>}
        <Link href="/records" className="site-text-button mt-4">Open My Reports for downloads and sharing</Link>
      </section>
    </div>
  );
}
