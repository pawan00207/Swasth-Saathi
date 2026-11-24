"use client";
import { useEffect, useState } from "react";
import { createRecordQr } from "./qr";

export default function RecordQr({ recordId = "demo-record-001" }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => { createRecordQr(recordId, window.location.origin).then(setDataUrl); }, [recordId]);
  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/records/view/${recordId}`);
    console.log("analytics:event", "qr_copy", recordId);
  }
  async function download() {
    const link=document.createElement("a"); link.href=dataUrl; link.download=`healthx-record-${recordId}.png`; link.click();
  }
  return <section className="rounded border bg-white p-4 text-center"><h2 className="font-bold">Record QR</h2>{dataUrl && <img src={dataUrl} alt={`QR code for record ${recordId}`} className="mx-auto mt-3 h-48 w-48"/>}<div className="mt-3 flex justify-center gap-2"><button onClick={copy} className="rounded bg-teal-800 px-3 py-2 text-sm text-white">Copy link</button><button onClick={download} className="rounded border px-3 py-2 text-sm">Download QR</button><button onClick={()=>window.print()} className="rounded border px-3 py-2 text-sm">Print</button></div></section>;
}
