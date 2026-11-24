"use client";
import { useCallback, useEffect, useState } from "react";
import hospitalsSeed from "./data/hospitals.json";
import { filterHospitals } from "./filterHospitals";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import LiveIndicator from "../../components/LiveIndicator";

export default function BedsFeature() {
  const [hospitals,setHospitals]=useState(hospitalsSeed);
  const [filters,setFilters]=useState({city:"",icu:false,oxygen:false,ventilator:false,pediatric:false,price:"",maxDistance:""});
  const [message,setMessage]=useState("");
  const [source,setSource]=useState("seeded-demo");
  const [lastRefresh,setLastRefresh]=useState(null);
  const [upstreamStatus,setUpstreamStatus]=useState(null);
  const [selectedHospital,setSelectedHospital]=useState(null);
  const [patient,setPatient]=useState({name:"",phone:"",urgency:"routine"});
  const [loading,setLoading]=useState(false);
  const [dialogMode,setDialogMode]=useState("");
  const [requestId,setRequestId]=useState("");
  const [correctionField,setCorrectionField]=useState("");
  const [correctionValue,setCorrectionValue]=useState("true");
  const [correctionNote,setCorrectionNote]=useState("");
  const refreshHospitals=useCallback(async()=>{
    try{
      const response=await fetch("/api/hospitals",{cache:"no-store"});
      if(!response.ok)throw new Error(`Hospital feed returned ${response.status}`);
      const data=await response.json();
      setHospitals(data.hospitals||hospitalsSeed);
      setSource(data.source||"seeded-demo");
      setUpstreamStatus(data.upstreamStatus||null);
      setLastRefresh(data.updatedAt||new Date().toISOString());
    }catch(error){
      console.error("Could not refresh hospital availability",error);
      setHospitals(hospitalsSeed);
      setSource("seeded-demo");
      setUpstreamStatus("unreachable");
      setLastRefresh(new Date().toISOString());
    }
  },[]);
  const refreshRequestStatus=useCallback(async()=>{
    if(!requestId)return;
    const supabase=getSupabaseBrowser();
    const {data}=await supabase?.auth.getSession()||{data:{session:null}};
    if(!data.session)return;
    const response=await fetch("/api/hospitals/requests",{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Could not refresh bed request status.");
    const request=result.requests?.find((item)=>item.id===requestId);
    if(request&&request.status!=="pending")setMessage(`Bed request ${requestId} is now ${request.status}.`);
  },[requestId]);
  const bedLive=useRealtimeRefresh(["bed-inventory-live"],refreshHospitals,30000);
  const requestLive=useRealtimeRefresh(requestId?[{name:`bed-request-${requestId}`,private:true}]:[],refreshRequestStatus,15000);
  useEffect(()=>{refreshHospitals();},[refreshHospitals]);
  useEffect(()=>{if(requestId)refreshRequestStatus().catch((error)=>console.error("Could not refresh bed request status",error));},[requestId,refreshRequestStatus]);
  function toggle(key){setFilters((f)=>({...f,[key]:!f[key]}));}
  const results=filterHospitals(hospitals,filters);
  async function submitRequest(event){
    event.preventDefault();
    if(!selectedHospital)return;
    setLoading(true);
    try{
      const supabase=getSupabaseBrowser();
      const {data:sessionData}=await supabase?.auth.getSession()||{data:{session:null}};
      if(!sessionData.session){
        setMessage("Sign in to submit a bed request.");
        return;
      }
      const response=await fetch("/api/hospitals/requests",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${sessionData.session.access_token}`},
        body:JSON.stringify({
          hospitalId:selectedHospital.id,
          bedType:filters.icu?"ICU":filters.oxygen?"Oxygen":filters.ventilator?"Ventilator":"General",
          patientName:patient.name,
          patientPhone:patient.phone,
          urgency:patient.urgency,
        }),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Bed request failed.");
      setRequestId(result.request.id);
      setMessage(`Request ${result.request.id} submitted. Status updates arrive live when connected; polling is used as a fallback.`);
      setSelectedHospital(null);
      setDialogMode("");
    }catch(error){
      setMessage(error.message||"Bed request failed.");
    }finally{
      setLoading(false);
    }
  }
  async function reportCorrection(event){
    event.preventDefault();
    const supabase=getSupabaseBrowser();
    const {data}=await supabase?.auth.getSession()||{data:{session:null}};
    if(!data.session){setMessage("Sign in to report an accessibility correction.");return;}
    try{
      const response=await fetch(`/api/hospitals/${encodeURIComponent(selectedHospital.id)}/accessibility-corrections`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},
        body:JSON.stringify({field:correctionField,reportedValue:correctionValue==="true",note:correctionNote}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not submit correction.");
      setMessage("Accessibility correction submitted for hospital review.");
      setSelectedHospital(null);
      setDialogMode("");
    }catch(error){setMessage(error.message||"Could not submit correction.");}
  }
  const isLive=source==="live-hms"||source==="prisma-live";
  function availabilityClass(count){return count<=0?"bg-red-100 text-red-900":count<5?"bg-amber-100 text-amber-900":"bg-green-100 text-green-900";}
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">ICU & Oxygen Bed Availability</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={bedLive&&(!requestId||requestLive)} />
        <p className={`rounded p-3 ${isLive?"bg-green-50 text-green-900":"bg-amber-50 text-amber-900"}`}>
          {isLive?"Hospital data is connected. Realtime updates are used when available; polling is the fallback.":`Demo data only. Real-time counts require a verified hospital feed.${upstreamStatus?` Feed status: ${upstreamStatus}.`:""}`}
        </p>
      </div>
      <section className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        <label>City<input className="ml-2 rounded border px-2 py-1" value={filters.city} onChange={(e)=>setFilters({...filters,city:e.target.value})}/></label>
        <label>Max distance (km)<input type="number" className="ml-2 w-20 rounded border px-2 py-1" value={filters.maxDistance} onChange={(e)=>setFilters({...filters,maxDistance:e.target.value})}/></label>
        <label>Price<select className="ml-2 rounded border px-2 py-1" value={filters.price} onChange={(e)=>setFilters({...filters,price:e.target.value})}><option value="">Any</option><option>Government</option><option>Private</option></select></label>
        {[["icu","ICU"],["oxygen","Oxygen"],["ventilator","Ventilator"],["pediatric","Pediatric ICU"]].map(([key,label])=><button key={key} aria-pressed={filters[key]} onClick={()=>toggle(key)} className={`rounded-full border px-3 py-1 ${filters[key]?"bg-teal-800 text-white":"bg-white"}`}>{label}</button>)}
      </section>
      {message&&<p role="status" className="mt-4 rounded border border-green-300 bg-green-50 p-3">{message}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {results.map((h)=><article key={h.id} className="rounded-lg border bg-white p-5">
          <div className="flex justify-between gap-2"><h2 className="text-lg font-bold">{h.name}</h2><span className={`rounded px-2 py-1 text-xs font-bold ${isLive?"bg-green-100 text-green-900":"bg-amber-100 text-amber-900"}`}>{isLive?"LIVE":"DEMO"}</span></div>
          <p className="text-sm text-slate-600">{h.address}, {h.city} - {h.distance} km</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">{[["ICU",h.icu],["Oxygen",h.oxygen],["Ventilator",h.ventilator],["Pediatric",h.pediatric]].map(([label,count])=><p key={label} className={`rounded px-2 py-1 ${availabilityClass(Number(count))}`}>{label}: <strong>{count}</strong> available</p>)}</div>
          <p className="mt-3 text-xs text-slate-500">{isLive?"Live hospital feed":`Demo seed data${lastRefresh?` refreshed ${new Date(lastRefresh).toLocaleTimeString()}`:""}`} - {h.priceRange}</p>
          <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2"><strong>Accessibility information</strong><span className={`rounded px-2 py-1 text-xs font-bold ${h.accessibility?.source==="staff-verified"?"bg-green-100 text-green-900":"bg-amber-100 text-amber-950"}`}>{h.accessibility?.source==="staff-verified"?"Staff verified":"Unverified"}</span></div>
            <p className="mt-1 text-slate-600">Ramp: {h.accessibility?.ramp==null?"Unknown":h.accessibility.ramp?"Yes":"No"} · Elevator: {h.accessibility?.elevator==null?"Unknown":h.accessibility.elevator?"Yes":"No"} · Wheelchair entrance: {h.accessibility?.wheelchairEntrance==null?"Unknown":h.accessibility.wheelchairEntrance?"Yes":"No"} · Accessible parking: {h.accessibility?.accessibleParking==null?"Unknown":h.accessibility.accessibleParking?"Yes":"No"}</p>
            {h.accessibility?.lastVerified&&<p className="mt-1 text-xs text-slate-500">Last verified: {new Date(h.accessibility.lastVerified).toLocaleDateString()}</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={()=>{setSelectedHospital(h);setDialogMode("bed");setPatient({name:"",phone:"",urgency:"routine"});}} className="rounded bg-teal-800 px-4 py-2 text-white">Request bed</button>
            <button onClick={()=>{setSelectedHospital(h);setDialogMode("correction");setCorrectionField("ramp");}} className="rounded border px-4 py-2">Report accessibility correction</button>
          </div>
        </article>)}
      </div>
      {results.length===0&&<p className="mt-6 rounded border border-dashed p-8 text-center">No hospitals match these filters.</p>}
      {selectedHospital&&dialogMode==="bed"&&<div role="dialog" aria-modal="true" aria-labelledby="bed-request-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={submitRequest} className="w-full max-w-md space-y-3 rounded-lg bg-white p-5"><h2 id="bed-request-title" className="text-xl font-bold">Request bed at {selectedHospital.name}</h2><label className="block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={patient.name} onChange={(e)=>setPatient({...patient,name:e.target.value})}/></label><label className="block">Contact phone<input required type="tel" autoComplete="tel" className="mt-1 w-full rounded border px-3 py-2" value={patient.phone} onChange={(e)=>setPatient({...patient,phone:e.target.value})}/></label><label className="block">Urgency<select className="mt-1 w-full rounded border px-3 py-2" value={patient.urgency} onChange={(e)=>setPatient({...patient,urgency:e.target.value})}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></label><div className="flex gap-2"><button disabled={loading} className="rounded bg-teal-800 px-4 py-2 text-white">{loading?"Submitting...":"Submit request"}</button><button type="button" onClick={()=>{setSelectedHospital(null);setDialogMode("");}} className="rounded border px-4 py-2">Cancel</button></div></form></div>}
      {selectedHospital&&dialogMode==="correction"&&<div role="dialog" aria-modal="true" aria-labelledby="accessibility-correction-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={reportCorrection} className="w-full max-w-md space-y-3 rounded-lg bg-white p-5"><h2 id="accessibility-correction-title" className="text-xl font-bold">Report accessibility information</h2><label className="block">Feature<select className="mt-1 w-full rounded border px-3 py-2" value={correctionField} onChange={(event)=>setCorrectionField(event.target.value)}><option value="ramp">Ramp</option><option value="elevator">Elevator</option><option value="wheelchairEntrance">Wheelchair entrance</option><option value="accessibleParking">Accessible parking</option></select></label><label className="block">Correct value<select className="mt-1 w-full rounded border px-3 py-2" value={correctionValue} onChange={(event)=>setCorrectionValue(event.target.value)}><option value="true">Available</option><option value="false">Not available</option></select></label><label className="block">Details (optional)<textarea maxLength={500} className="mt-1 w-full rounded border px-3 py-2" value={correctionNote} onChange={(event)=>setCorrectionNote(event.target.value)}/></label><div className="flex gap-2"><button className="rounded bg-teal-800 px-4 py-2 text-white">Submit correction</button><button type="button" onClick={()=>{setSelectedHospital(null);setDialogMode("");}} className="rounded border px-4 py-2">Cancel</button></div></form></div>}
    </div>
  );
}
