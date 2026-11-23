"use client";
import { useEffect, useState } from "react";
import hospitalsSeed from "./data/hospitals.json";
import { filterHospitals } from "./filterHospitals";

export default function BedsFeature() {
  const [hospitals,setHospitals]=useState(hospitalsSeed);
  const [filters,setFilters]=useState({city:"",icu:false,oxygen:false,ventilator:false,pediatric:false,price:"",maxDistance:""});
  const [message,setMessage]=useState("");
  const [source,setSource]=useState("seeded-demo");
  const [lastRefresh,setLastRefresh]=useState(null);
  const [upstreamStatus,setUpstreamStatus]=useState(null);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      try{
        const response=await fetch("/api/hospitals",{cache:"no-store"});
        const data=await response.json();
        if(!active)return;
        setHospitals(data.hospitals||hospitalsSeed);
        setSource(data.source||"seeded-demo");
        setUpstreamStatus(data.upstreamStatus||null);
        setLastRefresh(data.updatedAt||new Date().toISOString());
      }catch(error){
        console.error("Could not refresh hospital availability",error);
        if(active){setHospitals(hospitalsSeed);setSource("seeded-demo");setUpstreamStatus("unreachable");setLastRefresh(new Date().toISOString());}
      }
    };
    refresh();
    const interval=setInterval(refresh,30000);
    return()=>{active=false;clearInterval(interval);};
  },[]);
  function toggle(key){setFilters((f)=>({...f,[key]:!f[key]}));}
  const results=filterHospitals(hospitals,filters);
  function request(h){
    const requests=JSON.parse(localStorage.getItem("healthx_bed_requests")||"[]");
    localStorage.setItem("healthx_bed_requests",JSON.stringify([{hospitalId:h.id,hospital:h.name,requestedAt:new Date().toISOString(),status:"Pending demo request"},...requests]));
    setMessage(source==="live-hms"
      ? `Bed request submitted to ${h.name}. Confirmation is subject to hospital approval.`
      : `Demo request submitted to ${h.name}. This is not a confirmed hospital bed.`);
    console.log("analytics:event","bed_request",h.id);
  }
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">ICU & Oxygen Bed Availability</h1>
      <p className={`mt-2 rounded p-3 ${source==="live-hms"?"bg-green-50 text-green-900":"bg-amber-50 text-amber-900"}`}>
        {source==="live-hms"?"Live HMS data source active. Bed status refreshes every 30 seconds.":`Demo data only. Real-time availability requires verified hospital HMS integration.${upstreamStatus?` Configured feed status: ${upstreamStatus}.`:""}`}
      </p>
      <section className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        <label>City<input className="ml-2 rounded border px-2 py-1" value={filters.city} onChange={(e)=>setFilters({...filters,city:e.target.value})}/></label>
        <label>Max distance (km)<input type="number" className="ml-2 w-20 rounded border px-2 py-1" value={filters.maxDistance} onChange={(e)=>setFilters({...filters,maxDistance:e.target.value})}/></label>
        <label>Price<select className="ml-2 rounded border px-2 py-1" value={filters.price} onChange={(e)=>setFilters({...filters,price:e.target.value})}><option value="">Any</option><option>Government</option><option>Private</option></select></label>
        {[["icu","ICU"],["oxygen","Oxygen"],["ventilator","Ventilator"],["pediatric","Pediatric ICU"]].map(([key,label])=><button key={key} aria-pressed={filters[key]} onClick={()=>toggle(key)} className={`rounded-full border px-3 py-1 ${filters[key]?"bg-teal-800 text-white":"bg-white"}`}>{label}</button>)}
      </section>
      {message&&<p role="status" className="mt-4 rounded border border-green-300 bg-green-50 p-3">{message}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {results.map((h)=><article key={h.id} className="rounded-lg border bg-white p-5">
          <div className="flex justify-between gap-2"><h2 className="text-lg font-bold">{h.name}</h2><span className={`rounded px-2 py-1 text-xs font-bold ${source==="live-hms"?"bg-green-100 text-green-900":"bg-amber-100 text-amber-900"}`}>{source==="live-hms"?"LIVE":"DEMO"}</span></div>
          <p className="text-sm text-slate-600">{h.address}, {h.city} - {h.distance} km</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p>ICU: <strong>{h.icu}</strong></p><p>Oxygen: <strong>{h.oxygen}</strong></p><p>Ventilator: <strong>{h.ventilator}</strong></p><p>Pediatric: <strong>{h.pediatric}</strong></p></div>
          <p className="mt-3 text-xs text-slate-500">{source==="live-hms"?"Live hospital feed":`Demo seed data${lastRefresh?` refreshed ${new Date(lastRefresh).toLocaleTimeString()}`:""}`} - {h.priceRange}</p>
          <button onClick={()=>request(h)} className="mt-4 rounded bg-teal-800 px-4 py-2 text-white">Request bed</button>
        </article>)}
      </div>
      {results.length===0&&<p className="mt-6 rounded border border-dashed p-8 text-center">No hospitals match these filters.</p>}
    </div>
  );
}
