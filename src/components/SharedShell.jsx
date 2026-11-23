"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SaarthiChat from "../features/chat/SaarthiChat";

const links = [
  ["Schemes", "/schemes"],
  ["QR Reports", "/records/upload"],
  ["Accessible Route", "/route"],
  ["Teleconsult", "/consult"],
  ["Bed Availability", "/beds"],
];

export default function SharedShell({ children }) {
  const [role, setRole] = useState("Patient");

  useEffect(() => {
    const saved = localStorage.getItem("healthx_demo_role");
    if (saved) setRole(saved);
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
        <div className="bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950" role="status">
          Live integrations with demo fallbacks: schemes, routing, bed availability, reports and doctors are clearly marked where official/HMS data is unavailable.
        </div>
      </header>
      <main>{children}</main>
      <SaarthiChat />
    </div>
  );
}
