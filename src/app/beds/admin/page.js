"use client";
import { useEffect, useState } from "react";
import seed from "../../../features/beds/data/hospitals.json";

export default function BedAdminPage(){
  const [hospitals,setHospitals]=useState(seed); const [selected,setSelected]=useState(seed[0].id);
  useEffect(()=>{fetch("/api/hospitals").then(r=>r.json()).then(d=>d.hospitals&&setHospitals(d.hospitals)).catch(()=>{})},[]);
  const h=hospitals.find((x)=>x.id===selected)||hospitals[0];
  function update(key,value){setHospitals((v)=>v.map((x)=>x.id===selected?{...x,[key]:Math.max(0,Number(value)),lastUpdated:new Date().toISOString()}:x));}
  async function save(){
    const current=hospitals.find((x)=>x.id===selected);
    await fetch(`/api/hospitals/${selected}/beds`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(current)});
    console.log("analytics:event","bed_inventory_update",selected);
  }
  return <div className="mx-auto max-w-3xl px-4 py-8"><h1 className="text-3xl font-bold text-teal-900">Hospital Admin - Bed Inventory</h1><p className="mt-2">Demo HMS update. Counts reset if server restarts.</p><label className="mt-5 block">Hospital<select className="ml-2 rounded border px-3 py-2" value={selected} onChange={(e)=>setSelected(e.target.value)}>{hospitals.map((x)=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><div className="mt-5 grid grid-cols-2 gap-4">{[["icu","ICU"],["oxygen","Oxygen beds"],["ventilator","Ventilator"],["pediatric","Pediatric ICU"],["general","General beds"]].map(([key,label])=> <label key={key}>{label}<input type="number" className="mt-1 w-full rounded border px-3 py-2" value={h?.[key]||0} onChange={(e)=>update(key,e.target.value)}/></label>)}</div><button onClick={save} className="mt-5 rounded bg-teal-800 px-4 py-2 text-white">Update availability</button></div>;
}
