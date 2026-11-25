"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, PhoneCall } from "lucide-react";
import hospitalsSeed from "./data/hospitals.json";
import { filterHospitals } from "./filterHospitals";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import LiveIndicator from "../../components/LiveIndicator";
import AccessibleModal from "../../components/AccessibleModal";
import { useI18n } from "../../components/I18nProvider";
import { useVoice } from "../../lib/useVoice";

const emptyRequestForm = {
  patientName: "",
  patientAge: "",
  patientGender: "",
  whatsappPhone: "",
  bedType: "ICU",
  urgency: "urgent",
  reason: "",
  attendantName: "",
  attendantPhone: "",
  attachedReportId: "",
  whatsappConsent: false,
};

const emptyCorrectionForm = {
  ramp: "unknown",
  elevator: "unknown",
  wheelchairEntrance: "unknown",
  accessibleParking: "unknown",
  note: "",
  photoUrl: "",
};

function getHospitalFreshness(h, t) {
  const ts = h.staffUpdatedAt || (!h.demo ? h.lastUpdated : null);
  if (!ts) {
    return { kind: "demo", label: t("beds.demo"), badgeClass: "bg-amber-100 text-amber-950" };
  }
  const diffMs = Date.now() - new Date(ts).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMs <= 6 * 60 * 60 * 1000) {
    return {
      kind: "live",
      label: t("beds.liveUpdated", { minutes }),
      badgeClass: "bg-green-100 text-green-950",
    };
  }
  return { kind: "stale", label: t("beds.stale"), badgeClass: "bg-amber-100 text-amber-950" };
}

export default function BedsFeature() {
  const { language, t, formatDate, formatDateTime } = useI18n();
  const voice = useVoice(language);

  const [hospitals, setHospitals] = useState(hospitalsSeed);
  const [filters, setFilters] = useState({
    city: "",
    icu: false,
    oxygen: false,
    ventilator: false,
    pediatric: false,
    price: "",
    maxDistance: "",
  });
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [source, setSource] = useState("seeded-demo");
  const [hasStaffUpdated, setHasStaffUpdated] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [upstreamStatus, setUpstreamStatus] = useState(null);

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [dialogMode, setDialogMode] = useState("");
  const [reqForm, setReqForm] = useState(emptyRequestForm);
  const [corrForm, setCorrForm] = useState(emptyCorrectionForm);
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const [requestId, setRequestId] = useState("");
  const [trackedRequests, setTrackedRequests] = useState([]);

  const refreshHospitals = useCallback(async () => {
    try {
      const response = await fetch("/api/hospitals", { cache: "no-store" });
      if (!response.ok) throw new Error(`Hospital feed returned ${response.status}`);
      const data = await response.json();
      const list = data.hospitals || hospitalsSeed;
      setHospitals(list);
      setSource(data.source || "seeded-demo");
      setHasStaffUpdated(Boolean(data.hasStaffUpdated || list.some((h) => !h.demo || Boolean(h.staffUpdatedAt))));
      setUpstreamStatus(data.upstreamStatus || null);
      setLastRefresh(data.updatedAt || new Date().toISOString());
    } catch (error) {
      console.error("Could not refresh hospital availability", error);
      setHospitals(hospitalsSeed);
      setSource("seeded-demo");
      setHasStaffUpdated(false);
      setUpstreamStatus("unreachable");
      setLastRefresh(new Date().toISOString());
    }
  }, []);

  const refreshRequestStatus = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!data.session) return;
    const response = await fetch("/api/hospitals/requests", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not refresh bed request status.");
    const list = result.requests || [];
    setTrackedRequests(list);
    if (requestId) {
      const match = list.find((item) => item.id === requestId);
      if (match && match.status !== "pending") {
        setMessage(`Bed request #${requestId} is now ${match.status.toUpperCase()}.`);
      }
    }
  }, [requestId]);

  const loadReportsForAttach = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!data.session?.access_token) return;
    const res = await fetch("/api/reports", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const payload = await res.json();
      setUserReports(payload.reports || []);
    }
  }, []);

  const bedLive = useRealtimeRefresh(["bed-inventory-live"], refreshHospitals, 30000);
  const requestLive = useRealtimeRefresh(
    requestId ? [{ name: `bed-request-${requestId}`, private: true }] : [],
    refreshRequestStatus,
    15000,
  );

  useEffect(() => {
    refreshHospitals();
    refreshRequestStatus().catch(() => {});
  }, [refreshHospitals, refreshRequestStatus]);

  // Open pre-filled Request Bed modal if navigated from SOS hospital shortcut
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hospitalId = params.get("hospitalId");
    const wantReq = params.get("requestBed");
    const bedType = params.get("bedType");
    if (hospitalId && wantReq && hospitals.length) {
      const target = hospitals.find((h) => h.id === hospitalId);
      if (target) {
        setSelectedHospital(target);
        setDialogMode("bed");
        setReqForm((prev) => ({
          ...emptyRequestForm,
          bedType: bedType || prev.bedType || "ICU",
          urgency: "critical",
        }));
        loadReportsForAttach();
      }
    }
  }, [hospitals, loadReportsForAttach]);

  function toggle(key) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }

  const results = filterHospitals(hospitals, filters);

  function openRequestModal(hospital) {
    setSelectedHospital(hospital);
    setDialogMode("bed");
    setFormError("");
    setReqForm({
      ...emptyRequestForm,
      bedType: filters.icu
        ? "ICU"
        : filters.oxygen
          ? "Oxygen"
          : filters.ventilator
            ? "Ventilator"
            : filters.pediatric
              ? "Pediatric"
              : "ICU",
    });
    loadReportsForAttach();
  }

  function openCorrectionModal(hospital) {
    setSelectedHospital(hospital);
    setDialogMode("correction");
    setFormError("");
    setCorrForm({
      ramp: hospital.accessibility?.ramp === true ? "yes" : hospital.accessibility?.ramp === false ? "no" : "unknown",
      elevator: hospital.accessibility?.elevator === true ? "yes" : hospital.accessibility?.elevator === false ? "no" : "unknown",
      wheelchairEntrance:
        hospital.accessibility?.wheelchairEntrance === true
          ? "yes"
          : hospital.accessibility?.wheelchairEntrance === false
            ? "no"
            : "unknown",
      accessibleParking:
        hospital.accessibility?.accessibleParking === true
          ? "yes"
          : hospital.accessibility?.accessibleParking === false
            ? "no"
            : "unknown",
      note: "",
      photoUrl: "",
    });
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!selectedHospital) return;
    setFormError("");

    const cleanPhone = reqForm.whatsappPhone.replace(/[\s-]/g, "");
    if (!reqForm.patientName.trim()) {
      setFormError(t("errors.required"));
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone) && !/^\d{10}$/.test(cleanPhone)) {
      setFormError(t("errors.invalidPhone"));
      return;
    }
    const normalizedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+91${cleanPhone}`;

    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data: sessionData } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!sessionData.session) {
        setFormError("Sign in on Account (/auth) to submit a live hospital bed request.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/hospitals/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          hospitalId: selectedHospital.id,
          bedType: reqForm.bedType,
          patientName: reqForm.patientName.trim(),
          patientAge: reqForm.patientAge === "" ? null : Number(reqForm.patientAge),
          patientGender: reqForm.patientGender,
          patientPhone: normalizedPhone,
          whatsappPhone: normalizedPhone,
          urgency: reqForm.urgency,
          reason: reqForm.reason.trim(),
          attendantName: reqForm.attendantName.trim(),
          attendantPhone: reqForm.attendantPhone.trim(),
          attachedReportId: reqForm.attachedReportId || null,
          whatsappConsent: reqForm.whatsappConsent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bed request failed.");
      setRequestId(result.request.id);
      setTrackedRequests((curr) => [
        { ...result.request, hospital: { name: selectedHospital.name, city: selectedHospital.city } },
        ...curr,
      ]);
      setMessage(`Request #${result.request.id} submitted for ${selectedHospital.name}. Live tracker updated below.`);
      setSelectedHospital(null);
      setDialogMode("");
    } catch (error) {
      setFormError(error.message || "Bed request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setCorrForm((c) => ({ ...c, photoUrl: "" }));
      return;
    }
    if (file.size > 320_000) {
      setFormError("Optional photo must be smaller than 320 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCorrForm((c) => ({ ...c, photoUrl: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function reportCorrection(event) {
    event.preventDefault();
    setFormError("");
    const supabase = getSupabaseBrowser();
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!data.session) {
      setFormError("Sign in on Account (/auth) to report an accessibility correction.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/hospitals/${encodeURIComponent(selectedHospital.id)}/accessibility-corrections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(corrForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit correction.");
      setMessage("Accessibility correction submitted for hospital staff review.");
      setSelectedHospital(null);
      setDialogMode("");
    } catch (error) {
      setFormError(error.message || "Could not submit correction.");
    } finally {
      setLoading(false);
    }
  }

  const isLive = source === "live-hms" || hasStaffUpdated;
  function availabilityClass(count) {
    return count <= 0 ? "bg-red-100 text-red-900" : count < 5 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="service-mast flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-teal-900">{t("beds.title")}</h1>
        <a
          href="/beds/admin"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-teal-800 px-4 py-2 text-sm font-bold text-teal-900 hover:bg-teal-50"
        >
          Hospital Staff Admin Console
        </a>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={bedLive && (!requestId || requestLive)} />
        {!hasStaffUpdated && source !== "live-hms" && (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-950">
            Demo data only. Real-time counts update automatically once hospital staff submit bed counts.
            {upstreamStatus ? ` Feed status: ${upstreamStatus}.` : ""}
          </p>
        )}
        {isLive && (
          <p className="rounded bg-green-50 p-3 text-sm text-green-950">
            Live hospital bed inventory connected. Staff-updated counts sync via Realtime with polling fallback.
          </p>
        )}
      </div>

      {/* Filters */}
      <section aria-label="Bed availability filters" className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm font-semibold">
          City
          <input
            className="ml-2 min-h-[40px] rounded border px-2 py-1"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          Max distance (km)
          <input
            type="number"
            className="ml-2 min-h-[40px] w-20 rounded border px-2 py-1"
            value={filters.maxDistance}
            onChange={(e) => setFilters({ ...filters, maxDistance: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          Price
          <select
            className="ml-2 min-h-[40px] rounded border px-2 py-1"
            value={filters.price}
            onChange={(e) => setFilters({ ...filters, price: e.target.value })}
          >
            <option value="">Any</option>
            <option>Government</option>
            <option>Private</option>
          </select>
        </label>
        {[
          ["icu", "ICU"],
          ["oxygen", "Oxygen"],
          ["ventilator", "Ventilator"],
          ["pediatric", "Pediatric ICU"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters[key]}
            onClick={() => toggle(key)}
            className={`min-h-11 rounded-lg border px-3 py-1 text-sm font-semibold ${
              filters[key] ? "bg-teal-800 text-white" : "bg-white text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </section>

      {message && (
        <p role="status" className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-950">
          {message}
        </p>
      )}

      {/* Live Bed Request Tracker */}
      {trackedRequests.length > 0 && (
        <section aria-label={t("beds.trackerTitle")} className="mt-5 rounded-xl border border-teal-700 bg-white p-4">
          <h2 className="text-base font-bold text-teal-950">{t("beds.trackerTitle")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {trackedRequests.slice(0, 6).map((req) => (
              <div key={req.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs text-slate-700">#{req.id.slice(0, 10)}</strong>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                      req.status === "accepted"
                        ? "bg-green-100 text-green-950"
                        : req.status === "rejected"
                          ? "bg-red-100 text-red-950"
                          : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {t(`beds.statuses.${req.status}`)}
                  </span>
                </div>
                <p className="mt-1 font-bold text-slate-950">
                  {req.hospital?.name || "Hospital"} · {req.bedType}
                </p>
                <p className="text-xs text-slate-600">
                  {req.patientName} · Updated {formatDateTime(req.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hospital Cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {results.map((h) => {
          const freshness = getHospitalFreshness(h, t);
          return (
            <article key={h.id} className="site-panel">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-950">{h.name}</h2>
                <span className={`rounded px-2.5 py-1 text-xs font-extrabold ${freshness.badgeClass}`}>
                  {freshness.label}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {h.address}, {h.city} - {h.distance} km
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[
                  ["ICU", h.icu],
                  ["Oxygen", h.oxygen],
                  ["Ventilator", h.ventilator],
                  ["Pediatric", h.pediatric],
                ].map(([label, count]) => (
                  <p key={label} className={`rounded px-2.5 py-1.5 font-medium ${availabilityClass(Number(count))}`}>
                    {label}: <strong>{count}</strong> available
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {freshness.kind === "demo"
                  ? `Demo seed data${lastRefresh ? ` refreshed ${new Date(lastRefresh).toLocaleTimeString()}` : ""}`
                  : `Staff updated ${formatDateTime(h.staffUpdatedAt || h.lastUpdated)}`}{" "}
                · {h.priceRange}
              </p>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>Accessibility information</strong>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      h.accessibility?.source === "staff-verified"
                        ? "bg-green-100 text-green-950"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {h.accessibility?.source === "staff-verified" ? t("accessibility.staffVerified") : t("accessibility.unverified")}
                  </span>
                </div>
                <p className="mt-1 text-slate-700">
                  Ramp: {h.accessibility?.ramp == null ? t("accessibility.unknown") : h.accessibility.ramp ? t("accessibility.yes") : t("accessibility.no")} ·
                  Elevator: {h.accessibility?.elevator == null ? t("accessibility.unknown") : h.accessibility.elevator ? t("accessibility.yes") : t("accessibility.no")} ·
                  Wheelchair entrance: {h.accessibility?.wheelchairEntrance == null ? t("accessibility.unknown") : h.accessibility.wheelchairEntrance ? t("accessibility.yes") : t("accessibility.no")} ·
                  Accessible parking: {h.accessibility?.accessibleParking == null ? t("accessibility.unknown") : h.accessibility.accessibleParking ? t("accessibility.yes") : t("accessibility.no")}
                </p>
                {h.accessibility?.lastVerified && (
                  <p className="mt-1 text-xs text-slate-500">
                    Last verified: {formatDate(h.accessibility.lastVerified)}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openRequestModal(h)}
                  className="min-h-[44px] rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {t("beds.requestBed")}
                </button>
                <button
                  type="button"
                  onClick={() => openCorrectionModal(h)}
                  className="min-h-[44px] rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {t("beds.reportCorrection")}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {results.length === 0 && (
        <p className="mt-6 rounded border border-dashed p-8 text-center">No hospitals match these filters.</p>
      )}

      {/* Request Bed Accessible Modal */}
      <AccessibleModal
        open={Boolean(selectedHospital && dialogMode === "bed")}
        onClose={() => {
          setSelectedHospital(null);
          setDialogMode("");
        }}
        titleId="bed-request-modal-title"
        title={selectedHospital ? `${t("beds.requestBed")} — ${selectedHospital.name}` : t("beds.requestBed")}
        maxWidth="max-w-xl"
      >
        <form onSubmit={submitRequest} className="space-y-3" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-950">
            <span>{t("beds.emergencyNotice")}</span>
            <div className="flex gap-2">
              <a href="tel:108" className="inline-flex min-h-[36px] items-center gap-1 rounded bg-red-700 px-3 py-1 text-xs text-white">
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" /> 108
              </a>
              <a href="tel:112" className="inline-flex min-h-[36px] items-center gap-1 rounded bg-red-900 px-3 py-1 text-xs text-white">
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" /> 112
              </a>
            </div>
          </div>

          {formError && (
            <p role="alert" aria-live="assertive" className="rounded border border-red-700 bg-red-50 p-3 text-sm font-bold text-red-950">
              {formError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {t("beds.patientName")} *
              <input
                required
                autoComplete="name"
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
                value={reqForm.patientName}
                onChange={(e) => setReqForm({ ...reqForm, patientName: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.whatsappPhone")} *
              <input
                required
                type="tel"
                autoComplete="tel"
                placeholder="+919876543210"
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
                value={reqForm.whatsappPhone}
                onChange={(e) => setReqForm({ ...reqForm, whatsappPhone: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.age")}
              <input
                type="number"
                min="0"
                max="130"
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
                value={reqForm.patientAge}
                onChange={(e) => setReqForm({ ...reqForm, patientAge: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.gender")}
              <select
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                value={reqForm.patientGender}
                onChange={(e) => setReqForm({ ...reqForm, patientGender: e.target.value })}
              >
                <option value="">Prefer not to specify</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.bedType")}
              <select
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                value={reqForm.bedType}
                onChange={(e) => setReqForm({ ...reqForm, bedType: e.target.value })}
              >
                <option value="ICU">ICU</option>
                <option value="Oxygen">Oxygen</option>
                <option value="Ventilator">Ventilator</option>
                <option value="Pediatric">Pediatric</option>
                <option value="General">General</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.urgency")}
              <select
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                value={reqForm.urgency}
                onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value })}
              >
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="routine">Normal</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.attendantName")}
              <input
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
                value={reqForm.attendantName}
                onChange={(e) => setReqForm({ ...reqForm, attendantName: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("beds.attendantPhone")}
              <input
                type="tel"
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 px-3 py-2"
                value={reqForm.attendantPhone}
                onChange={(e) => setReqForm({ ...reqForm, attendantPhone: e.target.value })}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="bed-reason-input" className="text-sm font-semibold">
                {t("beds.reason")}
              </label>
              {voice.supported && (
                <button
                  type="button"
                  onClick={() =>
                    voice.listening
                      ? voice.stopListening()
                      : voice.listen((txt) => setReqForm((r) => ({ ...r, reason: r.reason ? `${r.reason} ${txt}` : txt })))
                  }
                  aria-label="Speak reason"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded border border-slate-400 px-2.5 py-1 text-xs font-semibold"
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{voice.listening ? "Listening..." : "Voice input"}</span>
                </button>
              )}
            </div>
            <textarea
              id="bed-reason-input"
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2 text-sm"
              value={reqForm.reason}
              onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
            />
          </div>

          {userReports.length > 0 && (
            <label className="block text-sm font-semibold">
              {t("beds.attachReport")}
              <select
                className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                value={reqForm.attachedReportId}
                onChange={(e) => setReqForm({ ...reqForm, attachedReportId: e.target.value })}
              >
                <option value="">None</option>
                {userReports.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.patient_name || rep.patientName} · {rep.report_type || rep.reportType} ({rep.report_date || ""})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-slate-300 bg-slate-50 p-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={reqForm.whatsappConsent}
              onChange={(e) => setReqForm({ ...reqForm, whatsappConsent: e.target.checked })}
            />
            <span>{t("beds.whatsappConsent")}</span>
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-teal-800 px-5 py-2 font-bold text-white hover:bg-teal-900 disabled:opacity-60"
            >
              {loading ? "Submitting..." : t("beds.submitRequest")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedHospital(null);
                setDialogMode("");
              }}
              className="min-h-[44px] rounded-lg border border-slate-400 px-5 py-2 font-semibold"
            >
              {t("beds.cancel")}
            </button>
          </div>
        </form>
      </AccessibleModal>

      {/* Report Accessibility Correction Accessible Modal */}
      <AccessibleModal
        open={Boolean(selectedHospital && dialogMode === "correction")}
        onClose={() => {
          setSelectedHospital(null);
          setDialogMode("");
        }}
        titleId="accessibility-correction-modal-title"
        title={selectedHospital ? `${t("accessibility.modalTitle")} — ${selectedHospital.name}` : t("accessibility.modalTitle")}
      >
        <form onSubmit={reportCorrection} className="space-y-3">
          {formError && (
            <p role="alert" aria-live="assertive" className="rounded border border-red-700 bg-red-50 p-3 text-sm font-bold text-red-950">
              {formError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["ramp", t("accessibility.ramp")],
              ["elevator", t("accessibility.elevator")],
              ["wheelchairEntrance", t("accessibility.wheelchairEntrance")],
              ["accessibleParking", t("accessibility.accessibleParking")],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <select
                  className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                  value={corrForm[key]}
                  onChange={(e) => setCorrForm({ ...corrForm, [key]: e.target.value })}
                >
                  <option value="yes">{t("accessibility.yes")}</option>
                  <option value="no">{t("accessibility.no")}</option>
                  <option value="unknown">{t("accessibility.unknown")}</option>
                </select>
              </label>
            ))}
          </div>

          <label className="block text-sm font-semibold">
            {t("accessibility.note")}
            <textarea
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded border border-slate-400 px-3 py-2"
              value={corrForm.note}
              onChange={(e) => setCorrForm({ ...corrForm, note: e.target.value })}
            />
          </label>

          <label className="block text-sm font-semibold">
            {t("accessibility.photo")}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="mt-1 block w-full text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-teal-800 px-5 py-2 font-bold text-white hover:bg-teal-900 disabled:opacity-60"
            >
              {loading ? "Submitting..." : t("accessibility.submit")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedHospital(null);
                setDialogMode("");
              }}
              className="min-h-[44px] rounded-lg border border-slate-400 px-5 py-2 font-semibold"
            >
              {t("beds.cancel")}
            </button>
          </div>
        </form>
      </AccessibleModal>
    </div>
  );
}
