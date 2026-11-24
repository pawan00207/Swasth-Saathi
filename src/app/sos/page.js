"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { PhoneCall, Plus, QrCode, ShieldAlert, Trash2 } from "lucide-react";
import { useI18n } from "../../components/I18nProvider";
import { generatePdf } from "../../lib/generatePdf";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { SUPPORTED_LANGUAGES } from "../../lib/i18n";

const emptyContact = () => ({ name: "", relation: "Family", whatsappPhone: "", optInStatus: "pending", sendOptIn: true });

export default function SosProfilePage() {
  const { language, t, formatDateTime } = useI18n();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({
    fullName: "",
    bloodGroup: "",
    allergies: "",
    conditions: "",
    medicines: "",
    preferredLanguage: language,
    cardEnabled: false,
  });
  const [contacts, setContacts] = useState([emptyContact()]);
  const [cardTokens, setCardTokens] = useState([]);
  const [generatedCard, setGeneratedCard] = useState(null);
  const [cardExpiry, setCardExpiry] = useState("1y");
  const [events, setEvents] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      try {
        const local = JSON.parse(localStorage.getItem("swasth_demo_emergency_profile") || "null");
        if (local) {
          setProfile(local.profile || profile);
          setContacts(local.contacts?.length ? local.contacts : [emptyContact()]);
        }
      } catch {
        // Ignore storage error
      }
      setLoading(false);
      return;
    }

    const { data, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      setError(sessionErr.message);
      setLoading(false);
      return;
    }
    const accessToken = data.session?.access_token || "";
    setToken(accessToken);
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [profRes, cardRes, sosRes] = await Promise.all([
        fetch("/api/sos/profile", { headers, cache: "no-store" }),
        fetch("/api/emergency-card", { headers, cache: "no-store" }),
        fetch("/api/sos", { headers, cache: "no-store" }),
      ]);
      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile((curr) => ({ ...curr, ...(profData.emergencyProfile || {}) }));
        setContacts(profData.contacts?.length ? profData.contacts : [emptyContact()]);
      }
      if (cardRes.ok) {
        const cardData = await cardRes.json();
        setCardTokens(cardData.tokens || []);
      }
      if (sosRes.ok) {
        const sosData = await sosRes.json();
        setEvents(sosData.events || []);
      }
    } catch (err) {
      setError(err.message || "Could not load emergency profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function updateContact(index, key, value) {
    setContacts((curr) => curr.map((c, idx) => (idx === index ? { ...c, [key]: value } : c)));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const validContacts = contacts.filter((c) => c.name.trim() || c.whatsappPhone.trim());
    for (const c of validContacts) {
      if (!c.name.trim() || !/^\+?\d{8,15}$/.test(c.whatsappPhone.replace(/[\s-]/g, ""))) {
        setError(t("errors.invalidPhone"));
        setBusy(false);
        return;
      }
    }

    if (!token) {
      localStorage.setItem("swasth_demo_emergency_profile", JSON.stringify({ profile, contacts: validContacts }));
      setMessage("Saved locally in demo mode. Sign in with Supabase/Prisma to send live WhatsApp opt-ins and SOS alerts.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/sos/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...profile,
          contacts: validContacts,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save emergency profile.");
      setProfile(result.emergencyProfile);
      setContacts(result.contacts?.length ? result.contacts : [emptyContact()]);
      setMessage("Emergency profile & contacts saved. Pending contacts received a WhatsApp YES opt-in prompt.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateEmergencyCard() {
    if (!token) {
      setError("Sign in with an account to generate a live Emergency QR Card.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/emergency-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiry: cardExpiry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create Emergency QR Card.");
      const qr = await QRCode.toDataURL(data.url);
      setGeneratedCard({ ...data, qr });
      setMessage("Emergency QR Card created.");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeCard(id) {
    if (!token) return;
    const res = await fetch(`/api/emergency-card?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessage("Emergency QR Card revoked.");
      setGeneratedCard(null);
      await loadAll();
    }
  }

  async function printCardPdf() {
    try {
      const qr = generatedCard?.qr || null;
      await generatePdf({
        fileName: "swasth-saathi-emergency-card.pdf",
        title: "Emergency Medical Card",
        watermark: "FOR EMERGENCY USE - CALL 108 / 112 IN INDIA",
        locale: profile.preferredLanguage || language,
        draw: (doc, fontFamily) => {
          doc.setFont(fontFamily);
          doc.setFontSize(13);
          doc.text(`Name: ${profile.fullName || "Not set"}`, 16, 40);
          doc.text(`Blood Group: ${profile.bloodGroup || "Unknown"}`, 16, 50);
          doc.setFontSize(11);
          doc.text(`Allergies: ${profile.allergies || "None listed"}`, 16, 62, { maxWidth: 120 });
          doc.text(`Conditions: ${profile.conditions || "None listed"}`, 16, 76, { maxWidth: 120 });
          doc.text(`Medicines: ${profile.medicines || "None listed"}`, 16, 90, { maxWidth: 120 });
          const primary = contacts.find((c) => c.name && c.whatsappPhone);
          doc.text(
            `Emergency Contact: ${primary ? `${primary.name} (${primary.whatsappPhone})` : "Not set"}`,
            16,
            106,
            { maxWidth: 175 },
          );
          doc.text("Emergency Helplines: 108 (Ambulance) / 112 (Emergency)", 16, 118);
          if (qr) {
            doc.addImage(qr, "PNG", 148, 38, 42, 42);
            doc.setFontSize(8);
            doc.text("Scan Emergency Card", 148, 85);
          }
        },
      });
    } catch (err) {
      setError("Could not generate printable Emergency Card PDF.");
    }
  }

  async function updateSosAction(id, action) {
    if (!token) return;
    const res = await fetch(`/api/sos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setMessage(action === "resolve" ? "Marked safe & tracking closed." : "Tracking link revoked.");
      await loadAll();
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-teal-900">
            <ShieldAlert className="h-7 w-7 text-red-700" aria-hidden="true" />
            <span>SOS Emergency Profile &amp; Contacts</span>
          </h1>
          <p className="mt-2 text-slate-700">
            Configure emergency medical details, up to 3 WhatsApp contacts (requires one-time YES opt-in), and your revocable Emergency QR Card.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="tel:108" className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-red-700 px-4 py-2 font-bold text-white">
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            <span>Call 108</span>
          </a>
          <a href="tel:112" className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-red-900 px-4 py-2 font-bold text-white">
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            <span>Call 112</span>
          </a>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-950">
        {t("sos.disclaimer")}
      </p>

      {!token && !loading && (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-950">
          Demo mode: sign in on <a href="/auth" className="font-bold underline">Account</a> to persist contacts, WhatsApp opt-ins, and live Emergency QR cards.
        </p>
      )}
      {message && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm font-semibold text-green-950">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm font-semibold text-red-950">{error}</p>}

      <form onSubmit={saveProfile} className="mt-6 space-y-6 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">Medical Summary for Emergency Card</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold">
            Full name
            <input
              required
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Blood group
            <select
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.bloodGroup}
              onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
            >
              <option value="">Select</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Allergies (comma separated)
            <input
              placeholder="e.g., Penicillin, Sulfa drugs"
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.allergies}
              onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Key medical conditions
            <input
              placeholder="e.g., Diabetes Type 2, Asthma"
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.conditions}
              onChange={(e) => setProfile({ ...profile, conditions: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold md:col-span-2">
            Current critical medicines
            <input
              placeholder="e.g., Insulin glargine, Salbutamol inhaler"
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.medicines}
              onChange={(e) => setProfile({ ...profile, medicines: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Preferred alert &amp; card language
            <select
              className="mt-1 min-h-[44px] w-full rounded border border-slate-300 px-3 py-2"
              value={profile.preferredLanguage}
              onChange={(e) => setProfile({ ...profile, preferredLanguage: e.target.value })}
            >
              {SUPPORTED_LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nativeLabel} ({item.label})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={profile.cardEnabled}
                onChange={(e) => setProfile({ ...profile, cardEnabled: e.target.checked })}
              />
              <span>Opt in to public Emergency QR Card (/e/token)</span>
            </label>
          </div>
        </div>

        <div className="border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Emergency Contacts (Max 3)</h2>
              <p className="text-xs text-slate-600">
                Contacts receive a one-time WhatsApp message and must reply <strong>YES</strong> before receiving SOS alerts.
              </p>
            </div>
            {contacts.length < 3 && (
              <button
                type="button"
                onClick={() => setContacts((c) => [...c, emptyContact()])}
                className="inline-flex min-h-[44px] items-center gap-1 rounded border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add contact</span>
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {contacts.map((contact, idx) => (
              <fieldset key={idx} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <legend className="px-1 text-xs font-bold uppercase text-slate-700">Contact {idx + 1}</legend>
                <label className="text-sm font-semibold">
                  Name
                  <input
                    className="mt-1 min-h-[44px] w-full rounded border border-slate-300 bg-white px-3 py-2"
                    value={contact.name}
                    onChange={(e) => updateContact(idx, "name", e.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Relation
                  <input
                    className="mt-1 min-h-[44px] w-full rounded border border-slate-300 bg-white px-3 py-2"
                    value={contact.relation}
                    onChange={(e) => updateContact(idx, "relation", e.target.value)}
                  />
                </label>
                <label className="text-sm font-semibold">
                  WhatsApp (+91...)
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    className="mt-1 min-h-[44px] w-full rounded border border-slate-300 bg-white px-3 py-2"
                    value={contact.whatsappPhone}
                    onChange={(e) => updateContact(idx, "whatsappPhone", e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-bold uppercase ${
                      contact.optInStatus === "opted_in"
                        ? "bg-green-100 text-green-900"
                        : contact.optInStatus === "opted_out"
                          ? "bg-red-100 text-red-900"
                          : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {contact.optInStatus === "opted_in"
                      ? "Opted in"
                      : contact.optInStatus === "opted_out"
                        ? "Opted out"
                        : "Pending YES"}
                  </span>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setContacts((curr) => curr.filter((_, pos) => pos !== idx))}
                      aria-label={`Remove contact ${idx + 1}`}
                      className="inline-flex min-h-[44px] items-center rounded border border-red-700 px-3 py-2 text-xs font-bold text-red-900"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-lg bg-teal-800 px-6 py-2.5 font-bold text-white hover:bg-teal-900 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Emergency Profile & Contacts"}
        </button>
      </form>

      <section className="mt-8 rounded-xl border bg-white p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-950">
          <QrCode className="h-5 w-5 text-teal-800" aria-hidden="true" />
          <span>Emergency QR Card (/e/token)</span>
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Shows ONLY blood group, allergies, key conditions, and your opted-in emergency contact. Revocable anytime.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Card expiry
            <select
              className="ml-2 min-h-[44px] rounded border border-slate-300 px-3 py-2"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(e.target.value)}
            >
              <option value="30d">30 days</option>
              <option value="1y">1 year</option>
              <option value="never">Never (revocable)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={generateEmergencyCard}
            className="min-h-[44px] rounded-lg bg-teal-800 px-4 py-2 font-bold text-white disabled:opacity-60"
          >
            Generate Emergency QR Card
          </button>
          <button
            type="button"
            onClick={printCardPdf}
            className="min-h-[44px] rounded-lg border border-teal-800 px-4 py-2 font-bold text-teal-900"
          >
            Print Emergency Card PDF
          </button>
        </div>

        {generatedCard && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border bg-slate-50 p-4">
            <img src={generatedCard.qr} alt="Emergency QR Card" className="h-36 w-36 rounded bg-white p-2" />
            <div className="space-y-1 text-sm">
              <p className="font-bold text-slate-950">Active Emergency Card Link</p>
              <a href={generatedCard.url} className="block break-all text-teal-900 underline">
                {generatedCard.url}
              </a>
              <p className="text-xs text-slate-600">
                {generatedCard.expiresAt ? `Expires: ${formatDateTime(generatedCard.expiresAt)}` : "No expiration until revoked"}
              </p>
            </div>
          </div>
        )}

        {cardTokens.length > 0 && (
          <div className="mt-4 space-y-2">
            {cardTokens.map((ct) => (
              <div key={ct.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-slate-50 p-3 text-sm">
                <span>
                  Card #{ct.id.slice(0, 8)} · Created {formatDateTime(ct.createdAt)} ·{" "}
                  <strong>{ct.revokedAt ? "Revoked" : "Active"}</strong>
                </span>
                {!ct.revokedAt && (
                  <button
                    type="button"
                    onClick={() => revokeCard(ct.id)}
                    className="min-h-[36px] rounded border border-red-700 px-3 py-1 text-xs font-bold text-red-900"
                  >
                    Revoke card
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section className="mt-8 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-bold text-slate-950">Recent SOS Events</h2>
          <div className="mt-3 space-y-3">
            {events.map((ev) => (
              <article key={ev.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
                <div>
                  <p className="font-bold">
                    {ev.isDrill ? "TEST ALERT · " : "EMERGENCY SOS · "}
                    {ev.neededBedType} · Status: <span className="uppercase">{ev.status}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Triggered {formatDateTime(ev.createdAt)}
                    {ev.acknowledgedAt ? ` · Contact acknowledged at ${formatDateTime(ev.acknowledgedAt)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {ev.status !== "resolved" && (
                    <button
                      type="button"
                      onClick={() => updateSosAction(ev.id, "resolve")}
                      className="min-h-[36px] rounded bg-green-800 px-3 py-1 text-xs font-bold text-white"
                    >
                      I&apos;m safe
                    </button>
                  )}
                  {!ev.trackingRevokedAt && (
                    <button
                      type="button"
                      onClick={() => updateSosAction(ev.id, "revoke-tracking")}
                      className="min-h-[36px] rounded border border-red-700 px-3 py-1 text-xs font-bold text-red-900"
                    >
                      Revoke tracking
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
