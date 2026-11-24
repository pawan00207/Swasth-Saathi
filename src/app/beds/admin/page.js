"use client";

import { useEffect, useState } from "react";
import seed from "../../../features/beds/data/hospitals.json";
import { getSupabaseBrowser } from "../../../lib/supabase/browser";
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
  const [audit, setAudit] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [accessToken, setAccessToken] = useState("");

  async function authorizedFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Hospital admin request failed.");
    return result;
  }

  async function refresh() {
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
      setLastUpdated(selectedHospital.lastUpdated || "");
      const details = await authorizedFetch(`/api/hospitals/${encodeURIComponent(selectedHospital.id)}/beds`);
      setAudit(details.audit || []);
    }
  }

  const realtimeConnected = useRealtimeRefresh(
    accessToken && selected ? ["bed-inventory-live", { name: `bed-requests-${selected}`, private: true }] : [],
    refresh,
    15000,
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      const supabase = getSupabaseBrowser();
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
      setAccessToken(data.session.access_token);
      const response = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const profileResult = await response.json();
      if (!response.ok) throw new Error(profileResult.error || "Could not verify staff role.");
      if (profileResult.profile.role !== "hospital_admin" || !profileResult.profile.hospitalId) {
        setMessage("Hospital administrator access required. Ask an authorized administrator to assign your hospital role.");
        return;
      }
      setSelected(profileResult.profile.hospitalId);
      const [hospitalResponse, requestResponse, inventoryResponse] = await Promise.all([
        fetch("/api/hospitals", { cache: "no-store" }),
        fetch("/api/hospitals/requests", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" }),
        fetch(`/api/hospitals/${encodeURIComponent(profileResult.profile.hospitalId)}/beds`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" }),
      ]);
      const [hospitalData, requestData, inventoryData] = await Promise.all([
        hospitalResponse.json(), requestResponse.json(), inventoryResponse.json(),
      ]);
      if (!hospitalResponse.ok || !requestResponse.ok || !inventoryResponse.ok) {
        throw new Error(hospitalData.error || requestData.error || inventoryData.error || "Could not load hospital staff data.");
      }
      if (!active) return;
      setHospitals(hospitalData.hospitals?.length ? hospitalData.hospitals : seed);
      setRequests(requestData.requests || []);
      setAudit(inventoryData.audit || []);
      setLastUpdated(hospitalData.hospitals?.find((hospital) => hospital.id === profileResult.profile.hospitalId)?.lastUpdated || "");
    }
    initialize().catch((error) => { if (active) setMessage(error.message || "Could not load hospital admin data."); });
    return () => { active = false; };
  }, []);

  const hospital = hospitals.find((item) => item.id === selected) || hospitals[0];
  function update(key, value) {
    setHospitals((items) => items.map((item) => item.id === selected
      ? { ...item, [key]: Math.max(0, Number(value)) }
      : item));
  }

  function updateAccessibility(key, value) {
    setHospitals((items) => items.map((item) => item.id === selected
      ? { ...item, accessibility: { ...(item.accessibility || {}), [key]: value === "" ? null : value === "true" } }
      : item));
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
      setLastUpdated(result.lastUpdated);
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
      setMessage(`Request ${requestId} ${status}.`);
    } catch (error) {
      setMessage(error.message || "Could not update request.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Hospital Admin - Bed Inventory</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={realtimeConnected} />
        <p className="text-slate-700">Staff access is role-verified. Realtime updates are used when connected; polling is the fallback.</p>
      </div>
      {hospital && <p className={`mt-4 rounded p-3 ${isStale(lastUpdated) ? "bg-amber-100 text-amber-950" : "bg-green-50 text-green-900"}`}>
        Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "No inventory update recorded"}
        {isStale(lastUpdated) ? " · STALE (older than 6 hours)" : " · Current"}
      </p>}
      {hospital && <div className="mt-5 grid grid-cols-2 gap-4">
        {[
          ["icu", "ICU"],
          ["oxygen", "Oxygen beds"],
          ["ventilator", "Ventilator"],
          ["general", "General beds"],
        ].map(([key, label]) => (
          <label key={key}>{label}<input min="0" type="number" className="mt-1 w-full rounded border px-3 py-2" value={hospital[key] ?? 0} onChange={(event) => update(key, event.target.value)} /></label>
        ))}
      </div>}
      {hospital && <fieldset className="mt-6 rounded-lg border bg-white p-4">
        <legend className="px-2 font-bold">Staff-verified accessibility information</legend>
        <p className="mb-3 text-sm text-slate-600">Set all fields to Yes or No to mark the information as staff-verified and timestamp it.</p>
        <div className="grid gap-3 sm:grid-cols-2">{[
          ["ramp", "Ramp"],
          ["elevator", "Elevator"],
          ["wheelchairEntrance", "Wheelchair entrance"],
          ["accessibleParking", "Accessible parking"],
        ].map(([key, label]) => {
          const value = hospital.accessibility?.[key];
          return <label key={key}>{label}<select className="mt-1 w-full rounded border px-3 py-2" value={value == null ? "" : String(value)} onChange={(event) => updateAccessibility(key, event.target.value)}>
            <option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option>
          </select></label>;
        })}</div>
      </fieldset>}
      {hospital && <button disabled={busy || !accessToken} onClick={save} className="mt-5 rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-60">{busy ? "Saving..." : "Update availability"}</button>}
      {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3">{message}</p>}
      {audit.length > 0 && <section className="mt-8">
        <h2 className="text-xl font-bold">Inventory audit log</h2>
        <ul className="mt-3 space-y-2">{audit.map((entry) => (
          <li key={entry.id} className="rounded border bg-white p-3 text-sm">
            <p><strong>{entry.actor.displayName || entry.actor.userId}</strong> · {new Date(entry.createdAt).toLocaleString()}</p>
            <p className="mt-1">{(Array.isArray(entry.changes) ? entry.changes : []).map((change) => `${change.bedType}: ${change.before ?? "new"} → ${change.after}`).join(" · ") || "No count changes"}</p>
          </li>
        ))}</ul>
      </section>}
      {requests.length > 0 && <section className="mt-8">
        <h2 className="text-xl font-bold">Bed requests</h2>
        <div className="mt-3 space-y-3">{requests.map((request) => (
          <article key={request.id} className="rounded border bg-white p-4">
            <p><strong>{request.patientName}</strong> · {request.bedType} · {request.urgency}</p>
            <p className="mt-1 text-sm">Contact: {request.patientPhone} · Status: {request.status}</p>
            {request.status === "pending" && <div className="mt-3 flex gap-2">
              <button onClick={() => updateRequest(request.id, "accepted")} className="rounded bg-green-800 px-3 py-2 text-white">Accept</button>
              <button onClick={() => updateRequest(request.id, "rejected")} className="rounded border border-red-700 px-3 py-2 text-red-900">Reject</button>
            </div>}
          </article>
        ))}</div>
      </section>}
    </div>
  );
}
