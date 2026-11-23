"use client";
import { useEffect, useState } from "react";
import schemes from "./data/schemes.json";
import { matchScheme } from "./eligibility";

export default function SchemesFeature() {
  const [profile, setProfile] = useState({search:"", disability:"none", income:"", landless:"", state:"", age:"", gender:"All", occupation:"All"});
  const [saved, setSaved] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => setSaved(JSON.parse(localStorage.getItem("healthx_saved_schemes") || "[]")), []);
  function update(key, value) { setProfile((p) => ({...p,[key]:value})); }
  function toggleSave(id) {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved,id];
    setSaved(next); localStorage.setItem("healthx_saved_schemes", JSON.stringify(next)); console.log("analytics:event", "scheme_save", id);
  }
  const filtered = schemes.filter((s) => {
    const hay = `${s.name} ${s.description} ${s.scope}`.toLowerCase();
    if (profile.search && !hay.includes(profile.search.toLowerCase())) return false;
    if (profile.disability !== "none" && s.eligibility.disabilities?.length && !s.eligibility.disabilities.includes(profile.disability)) return false;
    return true;
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Government Schemes & Subsidies</h1>
      <p className="mt-2 text-slate-600">Curated demo data. Confirm current rules on the official application portal.</p>
      <section className="mt-6 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4" aria-label="Scheme filters">
        <label>Search<input className="mt-1 w-full rounded border px-3 py-2" value={profile.search} onChange={(e)=>update("search",e.target.value)} /></label>
        <label>Disability<select className="mt-1 w-full rounded border px-3 py-2" value={profile.disability} onChange={(e)=>update("disability",e.target.value)}><option value="none">All</option><option>visual</option><option>hearing</option><option>mobility</option><option>intellectual</option><option>multiple</option></select></label>
        <label>Annual income (Rs.)<input type="number" className="mt-1 w-full rounded border px-3 py-2" value={profile.income} onChange={(e)=>update("income",e.target.value)} /></label>
        <label>Land ownership<select className="mt-1 w-full rounded border px-3 py-2" value={profile.landless} onChange={(e)=>update("landless",e.target.value)}><option value="">Any</option><option value="landless">Landless</option><option value="yes">Has land</option></select></label>
        <label>State<input className="mt-1 w-full rounded border px-3 py-2" value={profile.state} onChange={(e)=>update("state",e.target.value)} /></label>
        <label>Age<input type="number" className="mt-1 w-full rounded border px-3 py-2" value={profile.age} onChange={(e)=>update("age",e.target.value)} /></label>
        <label>Gender<select className="mt-1 w-full rounded border px-3 py-2" value={profile.gender} onChange={(e)=>update("gender",e.target.value)}><option>All</option><option>Female</option><option>Male</option><option>Other</option></select></label>
        <label>Occupation<select className="mt-1 w-full rounded border px-3 py-2" value={profile.occupation} onChange={(e)=>update("occupation",e.target.value)}><option>All</option><option>Student</option><option>Farmer</option><option>Labour</option><option>Construction</option><option>Artisan</option><option>Self-employed</option><option>Entrepreneur</option><option>Job seeker</option></select></label>
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => {
          const status=matchScheme(s,profile);
          return <article key={s.id} className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold">{s.name}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${status==="eligible"?"bg-green-100 text-green-900":status==="likely"?"bg-blue-100 text-blue-900":"bg-amber-100 text-amber-900"}`}>{status==="eligible"?"Eligible":status==="likely"?"Likely eligible":"Check documents"}</span></div>
            <p className="mt-2 text-sm text-slate-700">{s.description}</p><p className="mt-3 text-sm"><strong>Benefit:</strong> {s.benefits}</p>
            <div className="mt-4 flex gap-2"><button onClick={()=>setOpen(s)} className="rounded bg-teal-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-700">Details</button><button onClick={()=>toggleSave(s.id)} className="rounded border border-teal-800 px-3 py-2 text-sm">{saved.includes(s.id)?"Saved":"Save scheme"}</button></div>
          </article>;
        })}
      </div>
      {open && <div role="dialog" aria-modal="true" aria-labelledby="scheme-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6"><h2 id="scheme-title" className="text-2xl font-bold">{open.name}</h2><p className="mt-3">{open.description}</p><h3 className="mt-4 font-bold">Documents required</h3><ul className="list-disc pl-5">{open.documents.map((d)=><li key={d}>{d}</li>)}</ul><div className="mt-5 flex gap-3"><a href={open.applyLink} target="_blank" rel="noreferrer" className="rounded bg-teal-800 px-4 py-2 text-white">Official application</a><button onClick={()=>setOpen(null)} className="rounded border px-4 py-2">Close</button></div></div></div>}
    </div>
  );
}
