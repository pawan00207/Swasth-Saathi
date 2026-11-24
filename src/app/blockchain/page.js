"use client";

import { useEffect, useState } from "react";

const demoEntries = [
  {
    hash: "a83f1b6d0e4c98251f2b7a0d63ce91814c52db7f6a9e3402bc718e4d5f0a1203",
    channel: "demo-accesshealth",
    blockHeight: "1042",
    transactionId: "TX-DEMO-REPORT-001",
    recordId: "REPORT-DEMO-001",
  },
  {
    hash: "52cb71d94a2f0b38e66c0d91827abf5031d7c4e8a26bf1950d34e7c21862ac49",
    channel: "demo-accesshealth",
    blockHeight: "1048",
    transactionId: "TX-DEMO-BILL-1001",
    recordId: "BILL-1001",
  },
  {
    hash: "d91e3c7a48fb2d05e61c94a21b73ef8062bd150c4a89f237d5136c098b5e4201",
    channel: "demo-accesshealth",
    blockHeight: "1053",
    transactionId: "TX-DEMO-APPT-001",
    recordId: "APT-DEMO-001",
  },
];

export default function BlockchainPage() {
  const [entries, setEntries] = useState(demoEntries);
  const [status, setStatus] = useState("DWN demo ledger active");

  useEffect(() => {
    async function check() {
      const saved = JSON.parse(localStorage.getItem("healthx_fabric_entries") || "[]");
      setEntries([...saved, ...demoEntries]);
      try {
        const response = await fetch("/api/dhrs/blockchain/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Fabric unavailable");
        setStatus("Live demo attestation ledger active");
      } catch {
        setStatus("Live demo DWN ledger active");
      }
    }
    check();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Blockchain Verification</h1>
      <p role="status" className="mt-3 rounded bg-green-50 p-3 text-green-900">{status}</p>
      <div className="mt-6 space-y-3">
        {entries.map((entry) => (
          <article key={entry.hash} className="rounded-lg border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">{entry.recordId || "Anchored health record"}</h2>
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">DEMO ATTESTATION</span>
            </div>
            <p className="mt-3 break-all text-sm"><strong>Hash:</strong> {entry.hash}</p>
            <p className="mt-2 text-sm text-slate-600">
              Channel: {entry.channel || "demo-accesshealth"} · Block: {entry.blockHeight || "pending"} · Transaction: {entry.transactionId || "pending"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
