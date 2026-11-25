"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, PhoneCall, ShieldAlert } from "lucide-react";

export default function LiveSosTrackingPage({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTracking = useCallback(async () => {
    try {
      const res = await fetch(`/api/sos/track/${encodeURIComponent(params.token)}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Tracking link is unavailable.");
      setData(payload);
      setError("");
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    loadTracking();
    const interval = setInterval(loadTracking, 10000);
    return () => clearInterval(interval);
  }, [loadTracking]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-lg border-2 border-red-700 bg-red-50 p-4 text-center">
        <p className="flex items-center justify-center gap-2 font-bold text-red-950">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <span>Swasth Saathi Live SOS Tracking</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-red-900">
          SOS supplements, and does not replace, calling 108/112.
        </p>
      </div>

      {loading && <p role="status" className="mt-6 text-center">Loading live tracking status...</p>}
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950">{error}</p>}

      {data && (
        <section className="mt-6 space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold text-slate-950">{data.firstName}&apos;s SOS Alert</h1>
            <span className={`rounded px-3 py-1 text-xs font-extrabold uppercase ${data.isDrill ? "bg-amber-100 text-amber-950" : "bg-red-100 text-red-900"}`}>
              {data.isDrill ? "TEST ALERT DRILL" : data.status}
            </span>
          </div>

          <p className="text-sm text-slate-700">
            <strong>Status:</strong> {data.status} · <strong>Needed Bed:</strong> {data.neededBedType}
          </p>
          {data.hospitalName && (
            <p className="text-sm text-slate-700">
              <strong>Selected Hospital:</strong> {data.hospitalName}
            </p>
          )}
          {data.addressText && (
            <p className="text-sm text-slate-700">
              <strong>Reported Location:</strong> {data.addressText}
            </p>
          )}

          {data.latitude != null && data.longitude != null && (
            <a
              href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 font-bold text-white"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>Open Live Coordinates in Google Maps</span>
            </a>
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

          <p className="text-xs text-slate-500">
            Updated {new Date(data.updatedAt).toLocaleString()}
            {data.expiresAt ? ` · Link expires ${new Date(data.expiresAt).toLocaleString()}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}
