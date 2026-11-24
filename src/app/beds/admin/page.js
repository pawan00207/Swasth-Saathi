"use client";

import { useCallback, useEffect, useState } from "react";
import seed from "../../../features/beds/data/hospitals.json";
import { ensureSupabaseBrowser } from "../../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../../lib/useRealtimeRefresh";
import LiveIndicator from "../../../components/LiveIndicator";

function isStale(timestamp) {
  return !timestamp || Date.now() - new Date(timestamp).getTime() > 6 * 60 * 60 * 1000;
}

export default function BedAdminPage() {
  const [hospitals, setHospitals] = useState(seed);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [audit, setAudit] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const authorizedFetch = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Hospital admin request failed.");
      return result;
    },
    [accessToken],
  );

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const [hospitalData, requestData] = await Promise.all([
      fetch("/api/hospitals", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Could not refresh hospital inventory.");
        return response.json();
      }),
      authorizedFetch("/api/hospitals/requests"),
    ]);
    setHospitals(hospitalData.hospitals?.length ? hospitalData.hospitals : seed);
    setRequests(requestData.requests || []);
    const selectedHospital = hospitalData.hospitals?.find((hospital) => hospital.id === selected) || hospitalData.hospitals?.[0];
    if (!selected && selectedHospital) setSelected(selectedHospital.id);
    if (selectedHospital) {
      setLastUpdated(selectedHospital.staffUpdatedAt || selectedHospital.lastUpdated || "");
      const [details, corrData] = await Promise.all([
        authorizedFetch(`/api/hospitals/${encodeURIComponent(selectedHospital.id)}/beds`),
        authorizedFetch(`/api/hospitals/${encodeURIComponent(selectedHospital.id)}/accessibility-corrections`),
      ]);
      setAudit(details.audit || []);
      setCorrections(corrData.corrections || []);
    }
  }, [accessToken, authorizedFetch, selected]);

  const realtimeConnected = useRealtimeRefresh(
    accessToken && selected ? ["bed-inventory-live", { name: `bed-requests-${selected}`, private: true }] : [],
    refresh,
    15000,
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = await ensureSupabaseBrowser();
      if (!supabase) {
        setMessage("Sign in with an authorized hospital administrator account. Configure Supabase Auth and Prisma Postgres.");
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        setMessage("Sign in with an authorized hospital administrator account.");
        return;
      }
      const token = data.session.access_token;
      setAccessToken(token);
      const response = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const profileResult = await response.json();
      if (!response.ok) throw new Error(profileResult.error || "Could not verify staff role.");
      if (profileResult.profile.role !== "hospital_admin" || !profileResult.profile.hospitalId) {
        setMessage("Hospital administrator access required. Ask an authorized administrator to assign your hospital role.");
        return;
      }
      const hospitalId = profileResult.profile.hospitalId;
      setSelected(hospitalId);
      const [hospitalResponse, requestResponse, inventoryResponse, corrResponse] = await Promise.all([
        fetch("/api/hospitals", { cache: "no-store" }),
        fetch("/api/hospitals/requests", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`/api/hospitals/${encodeURIComponent(hospitalId)}/beds`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`/api/hospitals/${encodeURIComponent(hospitalId)}/accessibility-corrections`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      const [hospitalData, requestData, inventoryData, corrData] = await Promise.all([
        hospitalResponse.json(),
        requestResponse.json(),
        inventoryResponse.json(),
        corrResponse.json(),
      ]);
      if (!hospitalResponse.ok || !requestResponse.ok || !inventoryResponse.ok) {
        throw new Error(hospitalData.error || requestData.error || inventoryData.error || "Could not load hospital staff data.");
      }
      if (!active) return;
      setHospitals(hospitalData.hospitals?.length ? hospitalData.hospitals : seed);
      setRequests(requestData.requests || []);
      setAudit(inventoryData.audit || []);
      setCorrections(corrData.corrections || []);
      const currentHosp = hospitalData.hospitals?.find((hospital) => hospital.id === hospitalId);
      setLastUpdated(currentHosp?.staffUpdatedAt || currentHosp?.lastUpdated || "");
    }
    initialize().catch((error) => {
      if (active) setMessage(error.message || "Could not load hospital admin data.");
    });
    return () => {
      active = false;
    };
  }, []);

  const hospital = hospitals.find((item) => item.id === selected) || hospitals[0];

  function update(key, value) {
    setHospitals((items) =>
      items.map((item) =>
        item.id === selected
          ? { ...item, [key]: key === "staffWhatsapp" ? value : Math.max(0, Number(value)) }
          : item,
      ),
    );
  }

  function updateAccessibility(key, value) {
    setHospitals((items) =>
      items.map((item) =>
        item.id === selected
          ? { ...item, accessibility: { ...(item.accessibility || {}), [key]: value === "" ? null : value === "true" } }
          : item,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authorizedFetch(`/api/hospitals/${encodeURIComponent(selected)}/beds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hospital),
      });
      setLastUpdated(result.staffUpdatedAt || result.lastUpdated);
      await refresh();
      setMessage("Hospital inventory saved. Connected users receive Realtime updates; polling remains the fallback.");
    } catch (error) {
      setMessage(error.message || "Could not update inventory.");
    } finally {
      setBusy(false);
    }
  }

  async function updateRequest(requestId, status) {
    try {
      await authorizedFetch("/api/hospitals/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, status }),
      });
      await refresh();
      setMessage(`Request ${requestId} ${status}. Patient & live inventory updated.`);
    } catch (error) {
      setMessage(error.message || "Could not update request.");
    }
  }

  async function reviewCorrection(correctionId, status) {
    try {
      await authorizedFetch(`/api/hospitals/${encodeURIComponent(selected)}/accessibility-corrections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionId, status }),
      });
      await refresh();
      setMessage(`Accessibility correction ${status}.`);
    } catch (error) {
      setMessage(error.message || "Could not review accessibility correction.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Hospital Admin - Bed Inventory &amp; Accessibility</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={realtimeConnected} />
        <p className="text-slate-700">Staff access is role-verified. Realtime updates are used when connected; polling is the fallback.</p>
      </div>
      {hospital && (
        <p className={`mt-4 rounded p-3 text-sm font-semibold ${isStale(lastUpdated) ? "bg-amber-100 text-amber-950" : "bg-green-50 text-green-900"}`}>
          Last staff update: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "No inventory update recorded"}
          {isStale(lastUpdated) ? " · STALE (older than 6 hours)" : " · Live"}
        </p>
      )}
      {hospital && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            ["icu", "ICU"],
            ["oxygen", "Oxygen beds"],
            ["ventilator", "Ventilator"],
            ["pediatric", "Pediatric ICU"],
            ["general", "General beds"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm font-semibold">
              {label}
              <input
                min="0"
                type="number"
                className="mt-1 min-h-[44px] w-full rounded border px-3 py-2"
                value={hospital[key] ?? 0}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
          <label className="text-sm font-semibold">
            Staff WhatsApp alert phone
            <input
              type="tel"
              placeholder="+919876543210"
              className="mt-1 min-h-[44px] w-full rounded border px-3 py-2"
              value={hospital.staffWhatsapp ?? ""}
              onChange={(event) => update("staffWhatsapp", event.target.value)}
            />
          </label>
        </div>
      )}

      {hospital && (
        <fieldset className="mt-6 rounded-lg border bg-white p-4">
          <legend className="px-2 font-bold">Staff-verified accessibility information</legend>
          <p className="mb-3 text-sm text-slate-600">
            Set all fields to Yes or No to mark the information as staff-verified and timestamp it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["ramp", "Ramp"],
              ["elevator", "Elevator"],
              ["wheelchairEntrance", "Wheelchair entrance"],
              ["accessibleParking", "Accessible parking"],
            ].map(([key, label]) => {
              const value = hospital.accessibility?.[key];
              return (
                <label key={key} className="text-sm font-semibold">
                  {label}
                  <select
                    className="mt-1 min-h-[44px] w-full rounded border px-3 py-2"
                    value={value == null ? "" : String(value)}
                    onChange={(event) => updateAccessibility(key, event.target.value)}
                  >
                    <option value="">Unknown</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {hospital && (
        <button
          disabled={busy || !accessToken}
          onClick={save}
          className="mt-5 min-h-[44px] rounded bg-teal-800 px-5 py-2 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Saving..." : "Update availability"}
        </button>
      )}
      {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3 text-sm font-semibold">{message}</p>}

      {requests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Bed requests</h2>
          <div className="mt-3 space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-lg border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    #{request.id.slice(0, 8)} · {request.patientName}
                    {request.patientAge ? ` (${request.patientAge}y` : ""}
                    {request.patientGender ? `, ${request.patientGender})` : request.patientAge ? ")" : ""} · {request.bedType} ·{" "}
                    <span className="uppercase">{request.urgency}</span>
                  </p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase">{request.status}</span>
                </div>
                <p className="mt-1 text-slate-700">
                  Contact: {request.whatsappPhone || request.patientPhone}
                  {request.attendantName ? ` · Attendant: ${request.attendantName} (${request.attendantPhone || "N/A"})` : ""}
                </p>
                {request.reason && <p className="mt-1 text-slate-700">Reason: {request.reason}</p>}
                {request.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => updateRequest(request.id, "accepted")} className="min-h-[40px] rounded bg-green-800 px-4 py-1.5 font-bold text-white">
                      Accept
                    </button>
                    <button onClick={() => updateRequest(request.id, "rejected")} className="min-h-[40px] rounded border border-red-700 px-4 py-1.5 font-bold text-red-900">
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {corrections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Accessibility corrections queue</h2>
          <div className="mt-3 space-y-3">
            {corrections.map((corr) => (
              <article key={corr.id} className="rounded-lg border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    Correction #{corr.id.slice(0, 8)} · {new Date(corr.createdAt).toLocaleString()}
                  </p>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase">{corr.status}</span>
                </div>
                <p className="mt-1 text-slate-700">
                  Ramp: {corr.ramp || (corr.field === "ramp" ? String(corr.reportedValue) : "—")} ·
                  Elevator: {corr.elevator || (corr.field === "elevator" ? String(corr.reportedValue) : "—")} ·
                  Wheelchair entrance: {corr.wheelchairEntrance || (corr.field === "wheelchairEntrance" ? String(corr.reportedValue) : "—")} ·
                  Accessible parking: {corr.accessibleParking || (corr.field === "accessibleParking" ? String(corr.reportedValue) : "—")}
                </p>
                {corr.note && <p className="mt-1 text-slate-700">Note: {corr.note}</p>}
                {corr.photoUrl && (
                  <img src={corr.photoUrl} alt="Reported accessibility photo" className="mt-2 max-h-40 rounded border" />
                )}
                {corr.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => reviewCorrection(corr.id, "approved")}
                      className="min-h-[40px] rounded bg-green-800 px-4 py-1.5 font-bold text-white"
                    >
                      Approve &amp; Staff-verify
                    </button>
                    <button
                      onClick={() => reviewCorrection(corr.id, "rejected")}
                      className="min-h-[40px] rounded border border-red-700 px-4 py-1.5 font-bold text-red-900"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {audit.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Inventory audit log</h2>
          <ul className="mt-3 space-y-2">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded border bg-white p-3 text-sm">
                <p>
                  <strong>{entry.actor.displayName || entry.actor.userId}</strong> · {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="mt-1">
                  {(Array.isArray(entry.changes) ? entry.changes : [])
                    .map((change) => `${change.bedType}: ${change.before ?? "new"} → ${change.after}`)
                    .join(" · ") || "No count changes"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
