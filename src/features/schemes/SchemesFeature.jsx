"use client";
import AccessibleModal from "@/components/AccessibleModal";
import { useEffect, useState } from "react";
import { ExternalLink, Landmark, Search } from "lucide-react";
import seedSchemes from "./data/schemes.json";
import { explainSchemeMatch } from "./eligibility";
import { ensureSupabaseBrowser, getSupabaseBrowser } from "../../lib/supabase/browser";
import { sanitizeExternalPortalUrl } from "../../lib/url";

export default function SchemesFeature() {
  const [profile, setProfile] = useState({
    search: "",
    category: "All",
    scope: "All",
    disability: "none",
    income: "",
    landless: "",
    state: "",
    age: "",
    gender: "All",
    occupation: "All",
  });
  const [schemes, setSchemes] = useState(seedSchemes);
  const [saved, setSaved] = useState([]);
  const [open, setOpen] = useState(null);
  const [source, setSource] = useState("verified-directory");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [response, supabase] = await Promise.all([
          fetch("/api/schemes", { cache: "no-store" }),
          ensureSupabaseBrowser(),
        ]);
        if (!response.ok) throw new Error("Could not load schemes.");
        const data = await response.json();
        if (!active) return;
        if (data.schemes?.length) setSchemes(data.schemes);
        setSource(data.source || "verified-directory");
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
          setSource("verified-directory");
          setNotice("Showing Verified Scheme Directory (PM-JAY / MyScheme / DePwD).");
          setSaved(JSON.parse(localStorage.getItem("healthx_saved_schemes") || "[]"));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  function update(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function toggleSave(id) {
    const supabase = (await ensureSupabaseBrowser()) || getSupabaseBrowser();
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
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("healthx_saved_schemes", JSON.stringify(next));
  }

  const filtered = schemes.filter((s) => {
    const hay = `${s.name} ${s.description} ${s.benefits} ${s.scope} ${s.category || ""}`.toLowerCase();
    if (profile.search && !hay.includes(profile.search.toLowerCase())) return false;
    if (profile.category !== "All" && (s.category || "Healthcare").toLowerCase() !== profile.category.toLowerCase()) return false;
    if (profile.scope !== "All" && !String(s.scope || "").toLowerCase().includes(profile.scope.toLowerCase())) return false;
    if (profile.disability !== "none" && s.eligibility?.disabilities?.length && !s.eligibility.disabilities.includes(profile.disability)) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            Verified Entitlements · {source === "verified-directory" ? "PM-JAY / MyScheme / DePwD" : source}
          </p>
          <h1 className="integrated-service-title mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            <Landmark className="h-7 w-7 text-teal-800" aria-hidden="true" />
            <span>Government Schemes &amp; Subsidies</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Filter central &amp; state healthcare schemes and open their official government application portal directly.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
          <p className="text-xs font-semibold uppercase text-slate-500">Available Schemes</p>
          <p className="tabular-nums text-xl font-extrabold text-slate-950">{filtered.length}</p>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
          {notice}
        </p>
      )}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5" aria-label="Scheme filters">
        <label className="block text-xs font-semibold text-slate-700 md:col-span-2">
          Search Scheme or Keyword
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              placeholder="PM-JAY, dialysis, wheelchair, maternity, Maharashtra..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              value={profile.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </div>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Category
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={profile.category} onChange={(e) => update("category", e.target.value)}>
            <option value="All">All Categories</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Disability">Disability</option>
            <option value="Livelihood">Livelihood</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Scope
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={profile.scope} onChange={(e) => update("scope", e.target.value)}>
            <option value="All">Central &amp; State</option>
            <option value="Central">Central</option>
            <option value="State">State</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Disability
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={profile.disability} onChange={(e) => update("disability", e.target.value)}>
            <option value="none">All</option>
            <option value="visual">Visual</option>
            <option value="hearing">Hearing</option>
            <option value="mobility">Mobility</option>
            <option value="intellectual">Intellectual</option>
            <option value="multiple">Multiple</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Annual income (Rs.)
          <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={profile.income} onChange={(e) => update("income", e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          State
          <input placeholder="e.g. Maharashtra, Delhi" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={profile.state} onChange={(e) => update("state", e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Age
          <input type="number" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={profile.age} onChange={(e) => update("age", e.target.value)} />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Gender
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={profile.gender} onChange={(e) => update("gender", e.target.value)}>
            <option>All</option>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Occupation
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={profile.occupation} onChange={(e) => update("occupation", e.target.value)}>
            <option>All</option>
            <option>Student</option>
            <option>Farmer</option>
            <option>Labour</option>
            <option>Construction</option>
            <option>Artisan</option>
            <option>Self-employed</option>
            <option>Entrepreneur</option>
            <option>Job seeker</option>
          </select>
        </label>
      </section>

      {loading && (
        <p role="status" className="text-sm font-medium text-slate-600">
          Refreshing scheme catalogue...
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => {
          const eligibility = explainSchemeMatch(s, profile);
          const status = eligibility.status;
          const portalUrl = sanitizeExternalPortalUrl(s.applyLink) || "https://www.myscheme.gov.in";
          return (
            <article key={s.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-300">
              <div>
                <div className="flex items-start justify-between gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wide text-slate-500">
                    {s.scope || "Central"} · {s.category || "Healthcare"}
                  </span>
                  <span
                    className={`font-bold uppercase ${
                      status === "eligible"
                        ? "text-green-700"
                        : status === "likely"
                          ? "text-blue-700"
                          : "text-amber-700"
                    }`}
                  >
                    {status === "eligible" ? "Eligible" : status === "likely" ? "Likely Eligible" : "Check Docs"}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-bold leading-snug text-slate-950">
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-teal-800 hover:underline"
                  >
                    {s.name}
                  </a>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
                <p className="mt-3 text-xs text-slate-800">
                  <strong>Benefit:</strong> {s.benefits}
                </p>
                <p className="mt-1.5 text-xs text-slate-600">
                  <strong>Eligibility:</strong> {eligibility.reason}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-900"
                >
                  <span>Official Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(s)}
                  className="min-h-[38px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Details
                </button>
                <button
                  type="button"
                  aria-pressed={saved.includes(s.id)}
                  onClick={() => toggleSave(s.id)}
                  className={`min-h-[38px] rounded-lg border px-3 py-2 text-xs font-semibold ${
                    saved.includes(s.id)
                      ? "border-teal-700 bg-teal-50 text-teal-900"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {saved.includes(s.id) ? "Saved" : "Save"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <AccessibleModal open onClose={() => setOpen(null)} titleId="scheme-title" title={open.name} maxWidth="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              {open.scope || "Central"} · {open.category || "Healthcare"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{open.description}</p>
            <p className="mt-3 text-sm text-slate-900"><strong>Benefits:</strong> {open.benefits}</p>
            <h3 className="mt-4 text-sm font-bold text-slate-900">Documents required</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {(open.documents || []).map((d) => <li key={d}>{d}</li>)}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <a
                href={sanitizeExternalPortalUrl(open.applyLink) || "https://www.myscheme.gov.in"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900"
              >
                <span>Open Official Application Portal</span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="min-h-[42px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
        </AccessibleModal>
      )}
    </div>
  );
}
