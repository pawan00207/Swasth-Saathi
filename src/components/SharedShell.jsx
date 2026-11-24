"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SaarthiChat from "../features/chat/SaarthiChat";

const links = [
  ["Schemes", "/schemes"],
  ["QR Reports", "/records/upload"],
  ["My Reports", "/records"],
  ["Account", "/auth"],
  ["Appointments", "/appointments"],
  ["Billing", "/billing"],
  ["Accessible Route", "/route"],
  ["Teleconsult", "/consult"],
  ["Bed Availability", "/beds"],
  ["Blockchain", "/blockchain"],
];

export default function SharedShell({ children }) {
  const [role, setRole] = useState("Patient");
  const [showStatus, setShowStatus] = useState(false);
  const [bedStatus, setBedStatus] = useState("Checking");

  useEffect(() => {
    const saved = localStorage.getItem("healthx_demo_role");
    if (saved) setRole(saved);
    fetch("/api/hospitals", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setBedStatus(data.source === "live-hms" ? "Live HMS" : "Demo fallback"))
      .catch(() => setBedStatus("Demo fallback"));
  }, []);

  function changeRole(event) {
    const next = event.target.value;
    setRole(next);
    localStorage.setItem("healthx_demo_role", next);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-teal-900 bg-teal-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-xl font-bold focus:outline-none focus:ring-2 focus:ring-white">
            Swasth Saathi
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="rounded px-2 py-1 text-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-white">
                {label}
              </Link>
            ))}
          </nav>
          <label className="flex items-center gap-2 text-sm">
            Demo role
            <select value={role} onChange={changeRole} className="rounded border border-white bg-teal-950 px-2 py-1">
              <option>Patient</option>
              <option>Doctor</option>
              <option>Hospital Admin</option>
            </select>
          </label>
        </div>
        <div className="bg-amber-300 px-4 py-2 text-center text-sm text-amber-950" role="status">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span className="font-semibold">
              AccessHealth features are available now. Live/data integrations use verified sources; demo fallbacks are clearly labeled.
            </span>
            <button
              type="button"
              aria-expanded={showStatus}
              aria-controls="integration-status"
              onClick={() => setShowStatus((visible) => !visible)}
              className="shrink-0 rounded border border-amber-950 px-2 py-1 font-bold hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-950"
            >
              {showStatus ? "Hide status" : "View status"}
            </button>
          </div>
          {showStatus && (
            <div id="integration-status" className="mx-auto mt-2 grid max-w-7xl gap-2 rounded border border-amber-700 bg-amber-100 p-3 text-left sm:grid-cols-2 lg:grid-cols-5">
              <span><strong>Schemes:</strong> Live demo catalogue</span>
              <span><strong>Routing:</strong> Live demo route</span>
              <span><strong>Beds:</strong> {bedStatus}</span>
              <span><strong>Reports:</strong> Live demo OCR/DWN</span>
              <span><strong>Doctors:</strong> Live demo directory</span>
            </div>
          )}
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t bg-white px-4 py-4 text-center text-sm text-slate-700">
        Demo project, not a substitute for medical advice. For emergencies in India, call 108 or 112.
      </footer>
      <SaarthiChat />
    </div>
  );
}
