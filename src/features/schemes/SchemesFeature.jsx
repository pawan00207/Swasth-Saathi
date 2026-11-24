"use client";
import { useEffect, useState } from "react";
import AccessibleModal from "@/components/AccessibleModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="site-container py-8 sm:py-12">
      <h1>Government schemes and subsidies</h1>
      <p className="mt-2 text-slate-700">Find support schemes and check which eligibility rules might apply to you.</p>
      <p className="mt-3 text-sm text-slate-600">
        {source === "seeded-demo" ? "Showing the demo catalogue." : `Catalogue source: ${source}.`} Confirm current rules on the official application portal.
      </p>
      {notice && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-950">{notice}</p>}

      <section className="site-panel mt-6" aria-labelledby="scheme-filters">
        <h2 id="scheme-filters" className="text-lg font-semibold">Search and check eligibility</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">Search
            <Input type="search" value={profile.search} onChange={(event) => update("search", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Disability
            <select className="site-field" value={profile.disability} onChange={(event) => update("disability", event.target.value)}>
              <option value="none">All</option>
              {["visual", "hearing", "mobility", "intellectual", "multiple"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Annual income (₹)
            <Input type="number" value={profile.income} onChange={(event) => update("income", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Land ownership
            <select className="site-field" value={profile.landless} onChange={(event) => update("landless", event.target.value)}>
              <option value="">Any</option><option value="landless">Landless</option><option value="yes">Has land</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">State
            <Input value={profile.state} onChange={(event) => update("state", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Age
            <Input type="number" value={profile.age} onChange={(event) => update("age", event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Gender
            <select className="site-field" value={profile.gender} onChange={(event) => update("gender", event.target.value)}>
              {["All", "Female", "Male", "Other"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">Occupation
            <select className="site-field" value={profile.occupation} onChange={(event) => update("occupation", event.target.value)}>
              {["All", "Student", "Farmer", "Labour", "Construction", "Artisan", "Self-employed", "Entrepreneur", "Job seeker"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="scheme-results">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="scheme-results" className="text-xl font-semibold">Available schemes</h2>
          <p role="status" className="text-sm tabular-nums text-slate-600">
            {loading ? "Refreshing catalogue…" : `${filtered.length} ${filtered.length === 1 ? "scheme" : "schemes"}`}
          </p>
        </div>
        {!filtered.length && <p className="site-panel mt-4">No schemes match these filters. Try another search or disability filter.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((scheme) => {
            const eligibility = explainSchemeMatch(scheme, profile);
            const labels = { eligible: "Eligible", likely: "Likely eligible" };
            const isSaved = saved.includes(scheme.id);
            return (
              <article key={scheme.id} className="site-panel flex min-w-0 flex-col gap-3">
                <p className="text-sm font-medium text-teal-900">{labels[eligibility.status] || "Check documents"}</p>
                <h3 className="text-lg font-semibold">{scheme.name}</h3>
                <p className="text-sm text-slate-700">{scheme.description}</p>
                <p className="text-sm"><strong>Benefit:</strong> {scheme.benefits}</p>
                <p className="text-sm text-slate-700"><strong>Eligibility:</strong> {eligibility.reason}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={() => setOpen(scheme)} aria-label={`Details for ${scheme.name}`}>Details</Button>
                  <Button type="button" variant="outline" onClick={() => toggleSave(scheme.id)} aria-pressed={isSaved}>
                    {isSaved ? "Saved" : "Save scheme"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {open && (
        <AccessibleModal open onClose={() => setOpen(null)} titleId="scheme-title" title={open.name}>
          <p className="text-slate-700">{open.description}</p>
          <h3 className="mt-4 font-semibold">Documents required</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">{open.documents.map((document) => <li key={document}>{document}</li>)}</ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><a href={open.applyLink} target="_blank" rel="noreferrer">Official application</a></Button>
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>Close</Button>
          </div>
        </AccessibleModal>
      )}
    </div>
  );
}
