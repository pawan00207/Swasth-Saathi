"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureSupabaseBrowser } from "../../lib/supabase/browser";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let subscription;

    ensureSupabaseBrowser().then((supabase) => {
      if (!active || !supabase) return;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      });
      subscription = data.subscription;
    }).catch((error) => {
      console.error("Could not initialize authentication", error);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = await ensureSupabaseBrowser();
      if (!supabase) {
        setMessage("Supabase sign-in is not configured for this deployment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) to the host environment, then redeploy. For local development, set them in .env.local and restart the app.");
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setForgotPassword(false);
        setMessage("If an account exists for this email, a password reset link has been sent.");
        return;
      }

      if (passwordRecovery) {
        if (password !== confirmPassword) {
          setMessage("The new passwords do not match.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
        setMessage("Password updated. You are signed in.");
        router.push("/patient");
        return;
      }

      const result = signUp
        ? await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim() } },
        })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (result.error) throw result.error;
      if (signUp && !result.data.session) {
        setMessage("Account created. Check your email to confirm, then sign in.");
        return;
      }
      if (!result.data.session) {
        setMessage("No active session was returned. Confirm your email or try signing in again.");
        return;
      }
      router.push("/patient");
    } catch (error) {
      console.error("Authentication request failed", error?.name || "auth error");
      setMessage(error?.message || "Authentication failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = passwordRecovery
    ? "Choose a new password"
    : forgotPassword
      ? "Reset your password"
      : signUp
        ? "Create your account"
        : "Sign in to Swasth Saathi";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Supabase Encrypted Account</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-950">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Access your Patient Health Hub, medical reports, saved hospitals, and Care Wallet ledger.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {signUp && !forgotPassword && !passwordRecovery && (
            <label className="block text-sm font-semibold text-slate-800">
              Full Name
              <input required autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          {!passwordRecovery && (
            <label className="block text-sm font-semibold text-slate-800">
              Email
              <input required type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          {!forgotPassword && (
            <label className="block text-sm font-semibold text-slate-800">
              {passwordRecovery ? "New password" : "Password"}
              <input required type="password" minLength={8} autoComplete={passwordRecovery || signUp ? "new-password" : "current-password"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          )}
          {passwordRecovery && (
            <label className="block text-sm font-semibold text-slate-800">
              Confirm new password
              <input required type="password" minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          )}
          <button disabled={busy} className="min-h-[44px] w-full rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60">
            {busy
              ? "Please wait..."
              : passwordRecovery
                ? "Update password"
                : forgotPassword
                  ? "Send reset link"
                  : signUp
                    ? "Create account"
                    : "Sign in"}
          </button>
        </form>
        {!passwordRecovery && (
          <div className="mt-4 space-y-2">
            {!forgotPassword && (
              <button type="button" onClick={() => { setSignUp((value) => !value); setMessage(""); }} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                {signUp ? "Have an account? Sign in" : "New here? Create account"}
              </button>
            )}
            {!signUp && (
              <button type="button" onClick={() => { setForgotPassword((value) => !value); setMessage(""); }} className="w-full px-4 py-2 text-sm font-semibold text-teal-900 underline">
                {forgotPassword ? "Back to sign in" : "Forgot password?"}
              </button>
            )}
          </div>
        )}
        {message && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
      </div>
    </div>
  );
}
