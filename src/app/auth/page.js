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
      setMessage("Sign-in is unavailable in this demo. You can still browse the care services.");
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
    <div className="site-container account-page">
      <div className="account-intro">
        <h1>{signUp ? "Create your account" : "Sign in"}</h1>
        <p className="mt-3 text-slate-700">Your reports and saved schemes are private to your account.</p>
      </div>
      <div className="site-panel">
        <form onSubmit={submit} className="space-y-4">
          {signUp && (
            <label className="block text-sm font-semibold">
              Name
              <input required autoComplete="name" name="name" className="site-field mt-2"
                value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label className="block text-sm font-semibold">
            Email
            <input required type="email" autoComplete="username" name="email" className="site-field mt-2"
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input required type="password" minLength={8} autoComplete={signUp ? "new-password" : "current-password"}
              name="password" className="site-field mt-2" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={busy} aria-busy={busy} className="site-button site-button-primary w-full">
            {busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}
          </button>
        </form>
        {message && <p role="status" className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
        <button type="button" onClick={() => { setSignUp((value) => !value); setMessage(""); }} className="site-text-button mt-3">
          {signUp ? "Have an account? Sign in" : "New here? Create account"}
        </button>
      </div>
    </div>
  );
}
