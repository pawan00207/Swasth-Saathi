"use client";
import { useEffect, useState } from "react";
import { createRecordQr, getRecordDownloadUrl } from "./qr";
import { fetchPublicConfig } from "../../lib/supabase/browser";
import { resolveClientPublicOrigin } from "../../lib/url";

export default function RecordQr({ recordId = "REC-AIIMS-2026-0412" }) {
  const [dataUrl, setDataUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    let active = true;
    async function build() {
      const cfg = await fetchPublicConfig();
      const origin = resolveClientPublicOrigin(cfg?.appBaseUrl);
      if (active) setBaseUrl(origin);
      const qr = await createRecordQr(recordId, origin);
      if (active) setDataUrl(qr);
    }
    build();
    return () => { active = false; };
  }, [recordId]);

  const downloadHref = getRecordDownloadUrl(recordId, baseUrl);

  async function copy() {
    await navigator.clipboard.writeText(downloadHref);
  }

  async function downloadQr() {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `swasth-saathi-qr-${recordId}.png`;
    link.click();
  }

  return (
    <section className="rounded border bg-white p-4 text-center">
      <h2 className="font-bold">Scan to Download Report</h2>
      {dataUrl && <img src={dataUrl} alt={`QR code to download report ${recordId}`} className="mx-auto mt-3 h-48 w-48" />}
      {downloadHref && <p className="mt-2 break-all text-xs text-slate-600">{downloadHref}</p>}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a href={downloadHref} download className="rounded bg-teal-800 px-3 py-2 text-sm font-semibold text-white">Download Report</a>
        <button type="button" onClick={copy} className="rounded border px-3 py-2 text-sm">Copy link</button>
        <button type="button" onClick={downloadQr} className="rounded border px-3 py-2 text-sm">Download QR</button>
        <button type="button" onClick={() => window.print()} className="rounded border px-3 py-2 text-sm">Print</button>
      </div>
    </section>
  );
}
