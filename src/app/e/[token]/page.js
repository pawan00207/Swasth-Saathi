"use client";

import { useEffect, useState } from "react";
import { HeartPulse, PhoneCall } from "lucide-react";

export default function PublicEmergencyCardPage({ params }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/emergency-card/${encodeURIComponent(params.token)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Emergency card not available.");
        if (active) setCard(payload);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.token]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-lg border-2 border-red-700 bg-red-50 p-4 text-center">
        <p className="flex items-center justify-center gap-2 text-lg font-extrabold text-red-950">
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
          <span>Emergency Medical Card</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-red-900">
          SOS supplements, and does not replace, calling 108/112.
        </p>
      </div>

      {loading && <p role="status" className="mt-6 text-center">Loading emergency card...</p>}
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950">{error}</p>}

      {card && (
        <section className="mt-6 space-y-4 rounded-xl border-2 border-slate-900 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-600">Patient</p>
              <h1 className="text-2xl font-bold text-slate-950">{card.firstName}</h1>
            </div>
            <div className="rounded-lg bg-red-100 px-4 py-2 text-center">
              <p className="text-xs font-bold text-red-900">Blood Group</p>
              <p className="text-xl font-extrabold text-red-950">{card.bloodGroup || "Unknown"}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Allergies:</strong> {card.allergies || "None listed"}</p>
            <p><strong>Key Conditions:</strong> {card.conditions || "None listed"}</p>
          </div>

          {card.emergencyContact ? (
            <div className="rounded-lg border border-teal-700 bg-teal-50 p-4">
              <p className="text-xs font-bold uppercase text-teal-900">Opted-in Emergency Contact</p>
              <p className="mt-1 text-base font-bold text-slate-950">
                {card.emergencyContact.name} ({card.emergencyContact.relation})
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`tel:${card.emergencyContact.phone}`}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded bg-teal-800 px-4 py-2 text-sm font-bold text-white"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  <span>Call Contact</span>
                </a>
                <a
                  href={`https://wa.me/${card.emergencyContact.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center rounded border border-teal-800 bg-white px-4 py-2 text-sm font-bold text-teal-900"
                >
                  Message on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <p className="rounded bg-slate-50 p-3 text-sm text-slate-700">
              No opted-in emergency contact listed.
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t pt-4">
            <a href="tel:108" className="inline-flex min-h-[44px] items-center gap-1 rounded bg-red-700 px-4 py-2 font-bold text-white">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              <span>Call 108</span>
            </a>
            <a href="tel:112" className="inline-flex min-h-[44px] items-center gap-1 rounded bg-red-900 px-4 py-2 font-bold text-white">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              <span>Call 112</span>
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
