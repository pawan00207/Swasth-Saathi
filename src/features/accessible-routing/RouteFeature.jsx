"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import hospitals from "./hospitals.json";

const Map = dynamic(() => import("./RouteMap"), { ssr:false, loading:()=> <div className="h-96 animate-pulse rounded bg-slate-200">Loading map...</div> });

export default function RouteFeature() {
  const [origin,setOrigin]=useState("India Gate, New Delhi");
  const [destination,setDestination]=useState("AIIMS New Delhi");
  const [needs,setNeeds]=useState(["Avoid steps"]);
  const [route,setRoute]=useState(null);
  const [error,setError]=useState("");
  function toggle(n){setNeeds((v)=>v.includes(n)?v.filter((x)=>x!==n):[...v,n]);}
  async function plan(e) {
    e?.preventDefault(); setError("");
    try {
      const res=await fetch("/api/route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin,destination,needs})});
      const data=await res.json();
      setRoute(data); if(data.mock) console.log("analytics:event","mock_route_generated",destination);
    } catch { setError("Routing could not be completed. Showing no route instead of unsafe directions."); }
  }
  useEffect(()=>{plan();},[]);
  return <div className="mx-auto max-w-7xl px-4 py-8"><h1 className="text-3xl font-bold text-teal-900">Accessible Hospital Routing</h1><form onSubmit={plan} className="mt-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2"><label>Origin<input className="mt-1 w-full rounded border px-3 py-2" value={origin} onChange={(e)=>setOrigin(e.target.value)} required/></label><label>Destination<select className="mt-1 w-full rounded border px-3 py-2" value={destination} onChange={(e)=>setDestination(e.target.value)}>{hospitals.map((h)=><option key={h.id}>{h.name}</option>)}</select></label><fieldset className="md:col-span-2"><legend className="font-semibold">Accessibility needs</legend><div className="mt-2 flex flex-wrap gap-2">{["Avoid steps","Avoid stairs","Prefer smooth roads","Avoid high-traffic roads"].map((n)=><button type="button" aria-pressed={needs.includes(n)} key={n} onClick={()=>toggle(n)} className={`rounded-full border px-3 py-2 ${needs.includes(n)?"bg-teal-800 text-white":"bg-white"}`}>{n}</button>)}</div></fieldset><button className="w-fit rounded bg-teal-800 px-4 py-2 text-white">Plan accessible route</button></form>{error&&<p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-900">{error}</p>}<div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]"><div>{route&&<Map route={route}/>}</div>{route&&<aside className="rounded-lg border bg-white p-5"><span className={`rounded px-2 py-1 text-xs font-bold ${route.mock?"bg-amber-100 text-amber-900":"bg-green-100 text-green-900"}`}>{route.mock?"MOCK DEMO ROUTE":"OpenRouteService route"}</span><p className="mt-3"><strong>{route.distance}</strong> km</p><p><strong>{route.duration}</strong> min</p><h2 className="mt-4 font-bold">Turn-by-turn</h2><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{route.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><h2 className="mt-4 font-bold">Accessibility warnings</h2><ul className="mt-2 list-disc pl-5 text-sm">{route.warnings.map((w)=><li key={w}>{w}</li>)}</ul></aside>}</div></div>;
}
