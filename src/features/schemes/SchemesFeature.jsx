"use client";
import { useEffect, useState } from "react";
import seedSchemes from "./data/schemes.json";
import { explainSchemeMatch } from "./eligibility";
import { getSupabaseBrowser } from "../../lib/supabase/browser";

export default function SchemesFeature() {
  const [profile, setProfile] = useState({search:"", disability:"none", income:"", landless:"", state:"", age:"", gender:"All", occupation:"All"});
  const [schemes, setSchemes] = useState(seedSchemes);
  const [saved, setSaved] = useState([]);
  const [open, setOpen] = useState(null);
  const [source, setSource] = useState("seeded-demo");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [response, supabase] = await Promise.all([
          fetch("/api/schemes", { cache: "no-store" }),
          Promise.resolve(getSupabaseBrowser()),
        ]);
        if (!response.ok) throw new Error("Could not load schemes.");
        const data = await response.json();
        if (!active) return;
        if (data.schemes?.length) setSchemes(data.schemes);
        setSource(data.source || "seeded-demo");
        if (supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            const savedResponse = await fetch("/api/schemes/saved", {
              headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
              cache: "no-store",
            });
            const savedResult = await savedResponse.json();
            if (!savedResponse.ok) throw new Error(savedResult.error || "Could not load saved schemes.");
            if (active) setSaved(savedResult.saved || []);
            setLoading(false);
            return;
          }
        }
        setSaved(JSON.parse(localStorage.getItem("healthx_saved_schemes") || "[]"));
      } catch (error) {
        console.error("Could not load government schemes", error);
        if (active) {
          setSchemes(seedSchemes);
          setSource("seeded-demo");
          setNotice("Could not refresh schemes. Showing cached demo catalogue.");
          setSaved(JSON.parse(localStorage.getItem("healthx_saved_schemes") || "[]"));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);
  function update(key, value) { setProfile((p) => ({...p,[key]:value})); }
  async function toggleSave(id) {
    const supabase = getSupabaseBrowser();
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setNotice("Sign in to save schemes to your account.");
        return;
      }
      const isSaved = saved.includes(id);
      const response = await fetch("/api/schemes/saved", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ schemeId: id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(`Could not update saved schemes: ${result.error || "database error"}`);
        return;
      }
      const next = isSaved ? saved.filter((value) => value !== id) : [...saved, id];
      setSaved(next);
      setNotice("");
      return;
    }
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
      <p className="mt-2 text-slate-600">Catalogue source: {source === "seeded-demo" ? "cached demo data" : source}. Confirm current rules on the official application portal.</p>
      {notice && <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-amber-950">{notice}</p>}
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
      {loading && <p role="status" className="mt-4">Refreshing scheme catalogue...</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => {
          const eligibility=explainSchemeMatch(s,profile);
          const status=eligibility.status;
          return <article key={s.id} className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold">{s.name}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${status==="eligible"?"bg-green-100 text-green-900":status==="likely"?"bg-blue-100 text-blue-900":"bg-amber-100 text-amber-900"}`}>{status==="eligible"?"Eligible":status==="likely"?"Likely eligible":"Check documents"}</span></div>
            <p className="mt-2 text-sm text-slate-700">{s.description}</p><p className="mt-3 text-sm"><strong>Benefit:</strong> {s.benefits}</p>
            <p className="mt-2 text-sm text-slate-600"><strong>Eligibility:</strong> {eligibility.reason}</p>
            <div className="mt-4 flex gap-2"><button onClick={()=>setOpen(s)} className="rounded bg-teal-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-700">Details</button><button onClick={()=>toggleSave(s.id)} className="rounded border border-teal-800 px-3 py-2 text-sm">{saved.includes(s.id)?"Saved":"Save scheme"}</button></div>
          </article>;
        })}
      </div>
      {open && <div role="dialog" aria-modal="true" aria-labelledby="scheme-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6"><h2 id="scheme-title" className="text-2xl font-bold">{open.name}</h2><p className="mt-3">{open.description}</p><h3 className="mt-4 font-bold">Documents required</h3><ul className="list-disc pl-5">{open.documents.map((d)=><li key={d}>{d}</li>)}</ul><div className="mt-5 flex gap-3"><a href={open.applyLink} target="_blank" rel="noreferrer" className="rounded bg-teal-800 px-4 py-2 text-white">Official application</a><button onClick={()=>setOpen(null)} className="rounded border px-4 py-2">Close</button></div></div></div>}
    </div>
  );
}
