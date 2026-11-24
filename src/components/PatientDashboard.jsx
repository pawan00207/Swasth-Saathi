"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BedDouble,
  BookmarkCheck,
  Building2,
  CalendarClock,
  FileHeart,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";
import { ensureSupabaseBrowser } from "../lib/supabase/browser";

const EMPTY_PREFS = {
  preferredCity: "",
  accessibilityNeeds: {
    ramp: false,
    elevator: false,
    wheelchairEntrance: false,
    accessibleParking: false,
  },
  savedHospitals: [],
};

export default function PatientDashboard({ compact = false }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [networkHospitals, setNetworkHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [prefs, setPrefs] = useState(EMPTY_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [activeServiceTab, setActiveServiceTab] = useState("beds");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [supabase, hospRes] = await Promise.all([
        ensureSupabaseBrowser(),
        fetch("/api/hospitals", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const hospitals = Array.isArray(hospRes?.hospitals) ? hospRes.hospitals : [];
      setNetworkHospitals(hospitals);
      if (hospitals.length > 0 && !selectedHospitalId) {
        setSelectedHospitalId(hospitals[0].id);
      }

      if (!supabase) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const session = sessionData?.session;
      setUser(session?.user || null);
      setAccessToken(session?.access_token || "");

      if (!session?.access_token) {
        setDashboard(null);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/patient/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not load patient records.");
      setDashboard(payload);
      setPrefs(payload.savedPreferences || EMPTY_PREFS);
    } catch (err) {
      setError(err.message || "Unable to fetch patient dashboard.");
    } finally {
      setLoading(false);
    }
  }, [selectedHospitalId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function savePreferences(nextPrefs) {
    if (!accessToken) return;
    setSavingPrefs(true);
    setSaveMessage("");
    setError("");
    try {
      const res = await fetch("/api/patient/dashboard", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(nextPrefs),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save hospital preferences.");
      setPrefs(result.savedPreferences || nextPrefs);
      setSaveMessage("Hospital preferences saved to Supabase.");
    } catch (err) {
      setError(err.message || "Failed to update preferences.");
    } finally {
      setSavingPrefs(false);
    }
  }

  function addPreferredHospital() {
    const match = networkHospitals.find((h) => h.id === selectedHospitalId);
    if (!match) return;
    if (prefs.savedHospitals.some((h) => h.id === match.id)) {
      setSaveMessage(`${match.name} is already in your saved hospitals.`);
      return;
    }
    const nextPrefs = {
      ...prefs,
      savedHospitals: [
        { id: match.id, name: match.name, city: match.city || "", addedAt: new Date().toISOString() },
        ...prefs.savedHospitals,
      ],
    };
    setPrefs(nextPrefs);
    savePreferences(nextPrefs);
  }

  function removePreferredHospital(id) {
    const nextPrefs = {
      ...prefs,
      savedHospitals: prefs.savedHospitals.filter((h) => h.id !== id),
    };
    setPrefs(nextPrefs);
    savePreferences(nextPrefs);
  }

  function toggleAccessibility(key) {
    const nextPrefs = {
      ...prefs,
      accessibilityNeeds: {
        ...prefs.accessibilityNeeds,
        [key]: !prefs.accessibilityNeeds?.[key],
      },
    };
    setPrefs(nextPrefs);
  }

  if (loading) {
    return (
      <div className={compact ? "" : "mx-auto max-w-7xl px-4 py-8"} aria-busy="true" aria-label="Loading patient dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white p-4" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className={compact ? "rounded-xl border border-slate-200 bg-white p-6" : "mx-auto max-w-5xl px-4 py-10"}>
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Authenticated Patient Health Hub</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                Personal Medical History, Saved Hospitals &amp; Service Requests
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Sign in with your Swasth Saathi Supabase account to securely view your encrypted medical vault records,
                manage preferred accessible hospitals, and track past ICU/oxygen bed requests, teleconsults, and Care Wallet settlements.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-900"
              >
                Sign In to Patient Hub
              </Link>
              <Link
                href="/beds"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Browse Live Beds
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Personal Medical History</h2>
              <p className="mt-1 text-xs text-slate-600">
                Cloud clinical reports, allergies, blood group, chronic conditions, and emergency medication summary.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Saved Hospital Preferences</h2>
              <p className="mt-1 text-xs text-slate-600">
                Preferred hospitals, city, and verified ramp/elevator/wheelchair accessibility needs synced to Supabase.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Bed &amp; Service Request Ledger</h2>
              <p className="mt-1 text-xs text-slate-600">
                Real-time history of ICU/oxygen bed requests, doctor appointments, SOS alerts, and paid invoices.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const reports = dashboard?.medicalHistory?.reports || [];
  const emergencyProfile = dashboard?.medicalHistory?.emergencyProfile;
  const bedRequests = dashboard?.serviceHistory?.bedRequests || [];
  const appointments = dashboard?.serviceHistory?.appointments || [];
  const sosEvents = dashboard?.serviceHistory?.sosEvents || [];
  const recentBills = dashboard?.serviceHistory?.recentBills || [];

  return (
    <div className={compact ? "space-y-6" : "mx-auto max-w-7xl px-4 py-8 space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            Patient Health Hub · {dashboard?.dataSource || "Supabase"}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {dashboard?.patient?.displayName || user.email}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {dashboard?.patient?.email}
            {dashboard?.patient?.emergencyContact ? ` · Emergency Contact: ${dashboard.patient.emergencyContact}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh Data</span>
          </button>
          <Link
            href="/records/upload"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload Report</span>
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </p>
      )}
      {saveMessage && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {saveMessage}
        </p>
      )}

      {/* Key Metrics */}
      <section aria-label="Patient summary metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Clinical Reports</span>
            <FileHeart className="h-4 w-4 text-teal-700" aria-hidden="true" />
          </div>
          <p className="tabular-nums mt-2 text-2xl font-extrabold text-slate-950">{reports.length}</p>
          <p className="mt-1 text-xs text-slate-500">Stored in private medical vault</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Saved Hospitals</span>
            <BookmarkCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
          </div>
          <p className="tabular-nums mt-2 text-2xl font-extrabold text-slate-950">{prefs.savedHospitals.length}</p>
          <p className="mt-1 text-xs text-slate-500">
            {prefs.preferredCity ? `Preferred city: ${prefs.preferredCity}` : "Synced across devices"}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Bed Requests</span>
            <BedDouble className="h-4 w-4 text-teal-700" aria-hidden="true" />
          </div>
          <p className="tabular-nums mt-2 text-2xl font-extrabold text-slate-950">{bedRequests.length}</p>
          <p className="mt-1 text-xs text-slate-500">ICU, Oxygen &amp; Ward history</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Consults &amp; Bills</span>
            <Activity className="h-4 w-4 text-teal-700" aria-hidden="true" />
          </div>
          <p className="tabular-nums mt-2 text-2xl font-extrabold text-slate-950">
            {appointments.length + recentBills.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {appointments.length} consults · {recentBills.length} Care Wallet bills
          </p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Saved Hospital Preferences */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <Building2 className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <span>Saved Hospital Preferences</span>
            </h2>
            <button
              type="button"
              disabled={savingPrefs}
              onClick={() => savePreferences(prefs)}
              className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-60"
            >
              {savingPrefs ? "Saving..." : "Save Preferences"}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block text-xs font-semibold text-slate-700">
                Add Preferred Hospital
                <select
                  aria-label="Select hospital to save"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                >
                  {networkHospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!selectedHospitalId || savingPrefs}
                onClick={addPreferredHospital}
                className="self-end min-h-[38px] rounded-lg border border-teal-800 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
              >
                + Save Hospital
              </button>
            </div>

            {prefs.savedHospitals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
                No saved hospitals yet. Select a hospital above to bookmark it for one-tap bed requests and billing.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {prefs.savedHospitals.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{h.name}</p>
                      <p className="text-xs text-slate-500">{h.city || "India Network"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/beds" className="text-xs font-bold text-teal-800 hover:underline">
                        Check Beds
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${h.name}`}
                        onClick={() => removePreferredHospital(h.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Preferred City
                <input
                  type="text"
                  placeholder="e.g. New Delhi, Mumbai, Bengaluru"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={prefs.preferredCity}
                  onChange={(e) => setPrefs((curr) => ({ ...curr, preferredCity: e.target.value }))}
                />
              </label>
              <div className="text-xs font-semibold text-slate-700">
                <span>Accessibility Requirements</span>
                <div className="mt-2 grid grid-cols-2 gap-1.5 font-normal text-slate-800">
                  {[
                    ["wheelchairEntrance", "Wheelchair Gate"],
                    ["ramp", "Ramp Access"],
                    ["elevator", "Elevator"],
                    ["accessibleParking", "Accessible Parking"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(prefs.accessibilityNeeds?.[key])}
                        onChange={() => toggleAccessibility(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Personal Medical History */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <FileHeart className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <span>Personal Medical History</span>
            </h2>
            <Link href="/records" className="text-xs font-bold text-teal-800 hover:underline">
              Open Full Vault →
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-slate-900">Emergency Clinical Baseline</strong>
                <Link href="/sos" className="font-bold text-teal-800 hover:underline">
                  Update Profile
                </Link>
              </div>
              {emergencyProfile ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <dt className="text-slate-500">Blood Group</dt>
                    <dd className="font-bold text-slate-950">{emergencyProfile.bloodGroup || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Allergies</dt>
                    <dd className="font-medium text-slate-900">{emergencyProfile.allergies || "None recorded"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Conditions</dt>
                    <dd className="font-medium text-slate-900">{emergencyProfile.conditions || "None recorded"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Medications</dt>
                    <dd className="font-medium text-slate-900">{emergencyProfile.medicines || "None recorded"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1.5 text-slate-600">
                  No emergency medical baseline saved yet.{" "}
                  <Link href="/sos" className="font-semibold text-teal-800 underline">
                    Add blood group, allergies &amp; medications
                  </Link>
                  .
                </p>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-slate-800">No medical reports uploaded yet</p>
                <p className="mt-1 text-xs text-slate-600">
                  Upload lab reports, prescriptions, or discharge summaries to generate scannable QR links.
                </p>
                <Link
                  href="/records/upload"
                  className="mt-3 inline-flex rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white"
                >
                  Upload First Report
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 font-semibold">Report</th>
                      <th className="py-2 font-semibold">Doctor</th>
                      <th className="py-2 text-right font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.slice(0, 6).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-slate-900">{r.reportType}</p>
                          {r.notes && <p className="line-clamp-1 text-slate-500">{r.notes}</p>}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700">{r.doctorName || "Self-uploaded"}</td>
                        <td className="tabular-nums py-2.5 text-right text-slate-600">{r.reportDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Past Bed & Service Request History */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-950">Past Bed &amp; Service Request History</h2>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Service history categories">
            {[
              ["beds", `Bed Requests (${bedRequests.length})`, BedDouble],
              ["appointments", `Appointments (${appointments.length})`, CalendarClock],
              ["bills", `Care Wallet (${recentBills.length})`, Wallet],
              ["sos", `SOS Alerts (${sosEvents.length})`, ShieldAlert],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeServiceTab === key}
                onClick={() => setActiveServiceTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeServiceTab === key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {activeServiceTab === "beds" && (
            bedRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-600">
                No past bed requests found for your account.{" "}
                <Link href="/beds" className="font-bold text-teal-800 underline">
                  Search live ICU &amp; Oxygen beds
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Hospital</th>
                    <th className="py-2 font-semibold">Bed Type</th>
                    <th className="py-2 font-semibold">Urgency</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bedRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900">{req.hospitalName}</p>
                        <p className="text-slate-500">{req.city}</p>
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{req.bedType}</td>
                      <td className="py-2.5 pr-3 capitalize text-slate-700">{req.urgency}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`font-bold uppercase ${
                            req.status === "accepted"
                              ? "text-green-700"
                              : req.status === "rejected"
                                ? "text-red-700"
                                : "text-amber-700"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="tabular-nums py-2.5 text-right text-slate-600">
                        {new Date(req.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeServiceTab === "appointments" && (
            appointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-600">
                No past teleconsultations or OPD appointments yet.{" "}
                <Link href="/consult" className="font-bold text-teal-800 underline">
                  Book a verified specialist
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Doctor</th>
                    <th className="py-2 font-semibold">Mode</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900">{appt.doctorName}</p>
                        <p className="text-slate-500">{appt.speciality}</p>
                      </td>
                      <td className="py-2.5 pr-3 uppercase text-slate-700">{appt.mode}</td>
                      <td className="py-2.5 pr-3 font-bold uppercase text-teal-800">{appt.status}</td>
                      <td className="tabular-nums py-2.5 text-right text-slate-600">
                        {new Date(appt.startsAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeServiceTab === "bills" && (
            recentBills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-600">
                No Care Wallet hospital bills yet.{" "}
                <Link href="/billing" className="font-bold text-teal-800 underline">
                  Settle a hospital bill with Razorpay
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Invoice</th>
                    <th className="py-2 font-semibold">Hospital</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Total (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50">
                      <td className="font-mono py-2.5 pr-3 font-semibold text-slate-900">{bill.billNumber}</td>
                      <td className="py-2.5 pr-3 text-slate-700">{bill.hospitalName}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`font-bold uppercase ${bill.paymentStatus === "paid" ? "text-green-700" : "text-amber-700"}`}>
                          {bill.paymentStatus}
                        </span>
                      </td>
                      <td className="tabular-nums py-2.5 text-right font-bold text-slate-950">
                        Rs. {Number(bill.total || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeServiceTab === "sos" && (
            sosEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-600">
                No SOS emergency dispatches recorded on your account.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">SOS ID</th>
                    <th className="py-2 font-semibold">Needed Bed</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sosEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="font-mono py-2.5 pr-3 font-semibold text-slate-900">
                        {ev.id.slice(0, 14)} {ev.isDrill ? "(DRILL)" : ""}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{ev.neededBedType}</td>
                      <td className="py-2.5 pr-3 font-bold uppercase text-red-700">{ev.status}</td>
                      <td className="tabular-nums py-2.5 text-right text-slate-600">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </section>
    </div>
  );
}
