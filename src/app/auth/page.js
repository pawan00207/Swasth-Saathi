"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "../../lib/supabase/browser";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setMessage("Supabase is not configured. Add the project URL and anon key to .env.local.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = signUp
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (signUp && !result.data.session) {
      setMessage("Account created. Check your email to confirm, then sign in.");
      return;
    }
    router.push("/records");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-900">{signUp ? "Create your account" : "Sign in"}</h1>
      <p className="mt-2 text-sm text-slate-700">Your reports and saved schemes are private to your account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border bg-white p-5">
        {signUp && <label className="block">Name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label className="block">Email<input required type="email" autoComplete="email" className="mt-1 w-full rounded border px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="block">Password<input required type="password" minLength={8} autoComplete={signUp ? "new-password" : "current-password"} className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button disabled={busy} className="w-full rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Please wait..." : signUp ? "Create account" : "Sign in"}</button>
      </form>
      <button type="button" onClick={() => { setSignUp((value) => !value); setMessage(""); }} className="mt-4 rounded border border-teal-800 px-4 py-2 text-teal-900">
        {signUp ? "Have an account? Sign in" : "New here? Create account"}
      </button>
      {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
    </div>
  );
}
