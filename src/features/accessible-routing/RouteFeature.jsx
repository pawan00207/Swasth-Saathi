"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import hospitals from "./hospitals.json";

const Map = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="grid h-96 place-items-center rounded-xl bg-slate-100 text-slate-700" role="status">Loading map...</div> });

export default function RouteFeature() {
  const [origin, setOrigin] = useState("India Gate, New Delhi");
  const [destination, setDestination] = useState("AIIMS New Delhi");
  const [destinationCoordinates, setDestinationCoordinates] = useState(null);
  const [needs, setNeeds] = useState(["Avoid steps"]);
  const [mode, setMode] = useState("accessibility");
  const [route, setRoute] = useState(null);
  const [selectedAlternative, setSelectedAlternative] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [originCoordinates, setOriginCoordinates] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [nearbyFilters, setNearbyFilters] = useState({ emergencyOnly: false, icuOnly: false, speciality: "" });
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const positionRef = useRef(null);
  positionRef.current = originCoordinates;

  const plan = useCallback(async (coordinates = null) => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, needs, mode, originCoordinates: coordinates, destinationCoordinates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Route provider request failed.");
      setRoute(data);
      setSelectedAlternative(0);
      setLastUpdated(new Date().toISOString());
    } catch (reason) {
      setError(reason.message || "Routing failed. Call emergency services if this is urgent.");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, destinationCoordinates, needs, mode]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOriginCoordinates([position.coords.latitude, position.coords.longitude]);
        setOrigin("Current location");
        setError("");
      },
      (reason) => setError(`Could not access location: ${reason.message}`),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  useEffect(() => { plan(); }, []);

  useEffect(() => {
    if (!locationEnabled || mode !== "ambulance") return undefined;
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLocationEnabled(false);
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => setOriginCoordinates([position.coords.latitude, position.coords.longitude]),
      (reason) => setError(`Could not access location: ${reason.message}`),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    const refresh = setInterval(() => {
      const currentPosition = positionRef.current;
      if (currentPosition) plan(currentPosition);
    }, 30000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(refresh);
    };
  }, [locationEnabled, mode, plan]);

  async function findNearby() {
    const coordinates = positionRef.current;
    if (!coordinates) {
      setNearbyStatus("Enable ambulance mode location or enter your location first.");
      return;
    }
    setNearbyStatus("Searching nearby hospitals...");
    try {
      const response = await fetch(`/api/route/hospitals?lat=${coordinates[0]}&lon=${coordinates[1]}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nearby hospitals are unavailable.");
      setNearby(data.hospitals || []);
      setNearbyStatus(data.source === "openstreetmap-overpass" ? "Nearby OpenStreetMap results. Verify details and availability by phone." : data.error || "Nearby data source unavailable.");
    } catch (reason) {
      setNearbyStatus(reason.message);
    }
  }

  function navigate() {
    const originValue = positionRef.current?.slice().reverse().join(",") || origin;
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", originValue);
    url.searchParams.set("destination", destination);
    url.searchParams.set("travelmode", "driving");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  const displayRoute = route?.alternatives?.[selectedAlternative]
    ? { ...route, ...route.alternatives[selectedAlternative] }
    : route;
  const filteredNearby = nearby.filter((hospital) =>
    (!nearbyFilters.emergencyOnly || Boolean(hospital.emergency)) &&
    (!nearbyFilters.icuOnly || Number(hospital.icuAvailable) > 0) &&
    (!nearbyFilters.speciality || hospital.speciality?.toLowerCase().includes(nearbyFilters.speciality.toLowerCase())));
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
      <h1 className="text-3xl font-bold text-teal-900">Accessible hospital routing</h1>
      <p className="mt-2 text-sm text-slate-700">Use route estimates only as a travel aid. For emergencies, call 108 or 112.</p>
      <form onSubmit={(event) => { event.preventDefault(); plan(positionRef.current); }} className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2">
        <label>Origin<input className="mt-1 w-full rounded border px-3 py-2" value={origin} onChange={(event) => setOrigin(event.target.value)} required /></label>
        <label>Destination<select className="mt-1 w-full rounded border px-3 py-2" value={destination} onChange={(event) => { setDestination(event.target.value); setDestinationCoordinates(null); }}>{hospitals.map((hospital) => <option key={hospital.id}>{hospital.name}</option>)}</select></label>
        <label className="block">Route mode<select className="mt-1 w-full rounded border px-3 py-2" value={mode} onChange={(event) => setMode(event.target.value)}><option value="accessibility">Wheelchair accessibility</option><option value="ambulance">Ambulance / traffic-aware</option></select></label>
        <fieldset className="md:col-span-2"><legend className="font-semibold">Accessibility preferences</legend><div className="mt-2 flex flex-wrap gap-2">{["Avoid steps", "Avoid stairs", "Prefer smooth roads", "Avoid high-traffic roads"].map((item) => <button type="button" aria-pressed={needs.includes(item)} key={item} onClick={() => setNeeds((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item])} className={`min-h-11 rounded-lg border border-slate-400 px-3 py-2 ${needs.includes(item) ? "bg-teal-800 text-white" : "bg-white"}`}>{item}</button>)}</div></fieldset>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">{mode === "ambulance" ? <><button type="button" onClick={() => setLocationEnabled((enabled) => !enabled)} className="rounded border border-teal-800 px-3 py-2">{locationEnabled ? "Stop location sharing" : "Use live location (30s refresh)"}</button><span className="text-sm">{locationEnabled ? "Location updates on" : "Location is off"}</span></> : <button type="button" onClick={useCurrentLocation} className="rounded border border-teal-800 px-3 py-2">Use current location once</button>}</div>
        <button disabled={loading} className="w-fit rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-60">{loading ? "Finding route..." : "Plan route"}</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={navigate} className="rounded border border-teal-800 px-4 py-2">Navigate in Google Maps</button>
        <button onClick={findNearby} className="rounded border border-teal-800 px-4 py-2">Find nearby hospitals</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-900">{error}</p>}
      {nearbyStatus && <p role="status" className="mt-3 rounded bg-amber-50 p-3">{nearbyStatus}</p>}
      {nearby.length > 0 && <><div className="mt-4 flex flex-wrap gap-4 rounded border bg-white p-3"><label><input type="checkbox" checked={nearbyFilters.emergencyOnly} onChange={(event) => setNearbyFilters((filters) => ({ ...filters, emergencyOnly: event.target.checked }))} /> Emergency listed only</label><label><input type="checkbox" checked={nearbyFilters.icuOnly} onChange={(event) => setNearbyFilters((filters) => ({ ...filters, icuOnly: event.target.checked }))} /> ICU bed count greater than zero</label><label>Specialty contains<input className="ml-2 rounded border px-2 py-1" value={nearbyFilters.speciality} onChange={(event) => setNearbyFilters((filters) => ({ ...filters, speciality: event.target.value }))} /></label></div><section className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Nearby hospitals">{filteredNearby.map((hospital) => <article key={hospital.id} className="rounded border bg-white p-3"><h2 className="font-bold">{hospital.name}</h2><p className="text-sm">{hospital.distanceKm} km · Emergency: {hospital.emergency || "not listed"} · Wheelchair access: {hospital.wheelchair || "not listed"} · ICU beds: {hospital.icuAvailable ?? "not verified"}{hospital.bedInventorySource ? ` (${hospital.bedInventorySource} nearby match)` : ""}</p><button className="mt-2 text-sm underline" onClick={() => { setDestination(hospital.name); setDestinationCoordinates([hospital.lat, hospital.lon]); }}>Use as destination</button></article>)}{filteredNearby.length === 0 && <p>No nearby facilities match these filters.</p>}</section></>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>{displayRoute && <Map route={displayRoute} />}</div>
        {route && <aside className="rounded-lg border bg-white p-5">
          <span className={`rounded px-2 py-1 text-xs font-bold ${route.mock ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>{route.mock ? "Demo route" : route.source}</span>
          <p className="mt-3"><strong>{displayRoute.distance}</strong> km · <strong>{displayRoute.duration}</strong> min</p>
          {lastUpdated && <p className="text-xs text-slate-600">Updated {new Date(lastUpdated).toLocaleTimeString()}</p>}
          {route.alternatives?.length > 1 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Route alternatives">{route.alternatives.map((alternative, index) => <button key={`${alternative.distance}-${index}`} aria-pressed={selectedAlternative === index} onClick={() => setSelectedAlternative(index)} className={`rounded border px-3 py-2 text-sm ${selectedAlternative === index ? "bg-teal-800 text-white" : ""}`}>Route {index + 1} · {alternative.duration} min</button>)}</div>}
          <h2 className="mt-4 font-bold">Turn-by-turn</h2><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{displayRoute.steps?.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
          <h2 className="mt-4 font-bold">Warnings</h2><ul className="mt-2 list-disc pl-5 text-sm">{route.warnings?.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>}
      </div>
      <nav aria-label="Emergency calls" className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <a href="tel:108" className="rounded bg-red-700 px-5 py-3 font-bold text-white" aria-label="Call ambulance at 108">Call 108</a>
        <a href="tel:112" className="rounded bg-red-900 px-5 py-3 font-bold text-white" aria-label="Call emergency services at 112">Call 112</a>
      </nav>
    </div>
  );
}
