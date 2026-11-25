"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, MapPin, Mic, PhoneCall, ShieldAlert, Volume2 } from "lucide-react";
import AccessibleModal from "../../components/AccessibleModal";
import { useI18n } from "../../components/I18nProvider";
import { ensureSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import { useVoice } from "../../lib/useVoice";

export default function SosFloatingWidget() {
  const { t, language } = useI18n();
  const voice = useVoice(language);
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isDrill, setIsDrill] = useState(false);
  const [neededBedType, setNeededBedType] = useState("ICU");
  const [shareLocation, setShareLocation] = useState(false);
  const [addressText, setAddressText] = useState("");
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [gpsStatus, setGpsStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsWarning, setStatusIsWarning] = useState(false);
  const [preAlertedHospitals, setPreAlertedHospitals] = useState({});
  const busyRef = useRef(false);
  const clientRequestIdRef = useRef("");

  const captureLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("GPS unavailable — enter address manually.");
      return;
    }
    setGpsStatus("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setGpsStatus("GPS coordinates captured.");
      },
      () => {
        setGpsStatus("GPS denied or unavailable — enter your landmark/address below.");
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  const triggerSosNow = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCountdown(null);
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const supabase = await ensureSupabaseBrowser();
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      const headers = { "Content-Type": "application/json" };
      if (data.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      if (!clientRequestIdRef.current) {
        clientRequestIdRef.current = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      const response = await fetch("/api/sos", {
        method: "POST",
        headers,
        body: JSON.stringify({
          shareLocation,
          latitude: shareLocation ? coords.lat : null,
          longitude: shareLocation ? coords.lng : null,
          addressText: shareLocation ? addressText : "",
          neededBedType,
          isDrill,
          idempotencyKey: clientRequestIdRef.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send SOS alert.");
      setSosResult(result);
      const baseMessage = result.message ||
        `${isDrill ? "TEST ALERT" : "SOS"} dispatched to ${result.contactsNotified} opted-in contact(s).`;
      const telegramMessage = result.telegram?.sent
        ? "Telegram alert sent."
        : result.telegram?.status === "unconfigured"
          ? "Telegram alert not sent: the server bot token or destination chat ID is missing."
          : "Telegram alert not sent: delivery failed; check the bot, chat ID, and server logs.";
      setStatusMessage(`${baseMessage} ${telegramMessage}`);
      setStatusIsWarning(!result.telegram?.sent);
    } catch (err) {
      setError(err.message || t("errors.network"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [addressText, coords.lat, coords.lng, isDrill, neededBedType, shareLocation, t]);

  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown <= 0) {
      triggerSosNow();
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, triggerSosNow]);

  const refreshSosStatus = useCallback(async () => {
    const id = sosResult?.sosEvent?.id;
    if (!id || id.startsWith("SOS-LIVE-")) return;
    const supabase = await ensureSupabaseBrowser();
    const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
    if (!data.session?.access_token) return;
    const res = await fetch("/api/sos", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    if (!res.ok) return;
    const payload = await res.json();
    const latest = (payload.events || []).find((ev) => ev.id === id);
    if (latest) {
      setSosResult((curr) => curr ? { ...curr, sosEvent: { ...curr.sosEvent, ...latest } } : curr);
    }
  }, [sosResult?.sosEvent?.id]);

  useRealtimeRefresh(
    sosResult?.sosEvent?.id && !sosResult.sosEvent.id.startsWith("SOS-LIVE-") ? [`sos-event-${sosResult.sosEvent.id}`] : [],
    refreshSosStatus,
    10000,
  );

  async function markSafe() {
    if (!sosResult?.sosEvent?.id) return;
    if (sosResult.sosEvent.id.startsWith("SOS-LIVE-")) {
      setSosResult((curr) => ({ ...curr, sosEvent: { ...curr.sosEvent, status: "resolved" } }));
      setStatusMessage("SOS marked safe & closed.");
      setStatusIsWarning(false);
      return;
    }
    setBusy(true);
    try {
      const supabase = await ensureSupabaseBrowser();
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      const res = await fetch(`/api/sos/${encodeURIComponent(sosResult.sosEvent.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({ action: "resolve" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not send all-clear.");
      setSosResult((curr) => ({ ...curr, sosEvent: payload.sosEvent }));
      setStatusMessage("All-clear sent to opted-in contacts and live tracking closed.");
      setStatusIsWarning(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function preAlertHospital(hospitalId) {
    const sosEvent = sosResult?.sosEvent;
    if (!sosEvent?.id) {
      setError("Create an SOS alert before sending a hospital pre-alert.");
      return;
    }
    setError("");
    try {
      const supabase = await ensureSupabaseBrowser();
      const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
      const isLocalEvent = sosEvent.id.startsWith("SOS-LIVE-");
      const res = await fetch(
        isLocalEvent ? "/api/sos/pre-alert" : `/api/sos/${encodeURIComponent(sosEvent.id)}`,
        {
          method: isLocalEvent ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session?.access_token || ""}`,
          },
          body: JSON.stringify(isLocalEvent
            ? {
              sosId: sosEvent.id,
              hospitalId,
              bedType: sosEvent.neededBedType || neededBedType,
              isDrill: Boolean(sosEvent.isDrill),
            }
            : { action: "pre-alert", hospitalId }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Could not pre-alert hospital.");
      setPreAlertedHospitals((prev) => ({ ...prev, [hospitalId]: true }));
      setStatusMessage(`Telegram pre-alert sent for ${payload.hospitalName}.`);
      setStatusIsWarning(false);
    } catch (err) {
      setError(err.message || "Could not send Telegram pre-alert.");
    }
  }

  function openSosModal() {
    setOpen(true);
    setError("");
    setStatusMessage("");
    setStatusIsWarning(false);
    setSosResult(null);
    setPreAlertedHospitals({});
    setShareLocation(false);
    setCoords({ lat: null, lng: null });
    setGpsStatus("Location is private unless you share it below.");
    clientRequestIdRef.current = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const smsFallbackBody = encodeURIComponent(
    `${isDrill ? "TEST ALERT: " : "EMERGENCY SOS: "}Need ${neededBedType} bed. Location: ${
      shareLocation
        ? (coords.lat != null ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : (addressText || "Location unavailable"))
        : "Not shared"
    }`,
  );

  return (
    <>
      <button
        type="button"
        onClick={openSosModal}
        aria-label={t("sos.buttonLabel")}
        className="site-utility-action fixed bottom-5 left-5 z-40 flex min-h-11 items-center gap-2 rounded-lg border border-white bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-900"
      >
        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        <span>SOS</span>
      </button>

      <AccessibleModal
        open={open}
        onClose={() => {
          setCountdown(null);
          setOpen(false);
        }}
        titleId="sos-modal-title"
        title={t("sos.modalTitle")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-950">
            <p>{t("sos.disclaimer")}</p>
            {language !== "en" && (
              <p className="mt-1 text-xs text-red-900">
                {t("shell.englishOriginal")}: SOS supplements, and does not replace, calling 108/112.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="tel:108"
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-lg font-extrabold text-white shadow hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              <span>{t("sos.call108")}</span>
            </a>
            <a
              href="tel:112"
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-red-900 px-4 py-3 text-lg font-extrabold text-white shadow hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-red-300"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              <span>{t("sos.call112")}</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/sos"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-teal-900 underline"
            >
              Manage Emergency Contacts &amp; QR Card
            </Link>
            {voice.ttsSupported && (
              <button
                type="button"
                onClick={() =>
                  voice.speak(
                    `${t("sos.disclaimer")} ${t("sos.call108")}. ${t("sos.call112")}.`,
                  )
                }
                className="inline-flex min-h-[44px] items-center gap-1 rounded border border-slate-400 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span>{t("sos.voiceRead")}</span>
              </button>
            )}
          </div>

          {!sosResult && (
            <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-900">
                  {t("sos.neededBed")}
                  <select
                    className="mt-1 min-h-[44px] w-full rounded border border-slate-400 bg-white px-3 py-2"
                    value={neededBedType}
                    onChange={(e) => setNeededBedType(e.target.value)}
                  >
                    <option value="ICU">ICU</option>
                    <option value="Oxygen">Oxygen</option>
                    <option value="Ventilator">Ventilator</option>
                    <option value="Pediatric">Pediatric</option>
                    <option value="General">General</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={isDrill}
                      onChange={(e) => setIsDrill(e.target.checked)}
                    />
                    <span>{t("sos.drillLabel")}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={shareLocation}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShareLocation(next);
                      if (next && coords.lat == null) {
                        captureLocation();
                      }
                    }}
                  />
                  <span>Share my GPS / landmark location with SOS alert</span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="sos-address-input" className="text-sm font-semibold text-slate-900">
                    Location / Landmark (optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {shareLocation && coords.lat != null ? `${coords.lat}, ${coords.lng}` : gpsStatus}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShareLocation(true);
                        captureLocation();
                      }}
                      className="rounded border border-teal-700 bg-white px-2 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-50"
                    >
                      Share GPS
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <input
                    id="sos-address-input"
                    type="text"
                    placeholder="Street, landmark, or area (shared only if enabled above)"
                    className="min-h-[44px] flex-1 rounded border border-slate-400 bg-white px-3 py-2 text-sm"
                    value={addressText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddressText(val);
                      if (val.trim()) setShareLocation(true);
                    }}
                  />
                  {voice.supported && (
                    <button
                      type="button"
                      onClick={() =>
                        voice.listening
                          ? voice.stopListening()
                          : voice.listen((text) => {
                              setShareLocation(true);
                              setAddressText((prev) => (prev ? `${prev} ${text}` : text));
                            })
                      }
                      aria-label={t("sos.voiceInput")}
                      className={`min-h-[44px] rounded border px-3 py-2 text-sm font-semibold ${
                        voice.listening ? "border-red-700 bg-red-100 text-red-900" : "border-slate-400 bg-white text-slate-900"
                      }`}
                    >
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {countdown !== null ? (
                <div className="rounded-lg border-2 border-red-700 bg-red-100 p-4 text-center" role="alert">
                  <p className="text-lg font-extrabold text-red-950">
                    {t("sos.countdownText", { seconds: countdown })}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCountdown(null)}
                      className="min-h-[48px] rounded-lg border-2 border-slate-900 bg-white px-6 py-2 text-base font-extrabold text-slate-950"
                    >
                      {t("sos.cancelCountdown")}
                    </button>
                    <button
                      type="button"
                      onClick={triggerSosNow}
                      className="min-h-[48px] rounded-lg bg-red-700 px-6 py-2 text-base font-extrabold text-white"
                    >
                      {t("sos.triggerNow")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCountdown(5)}
                    className="min-h-[48px] flex-1 rounded-lg bg-red-700 px-5 py-3 text-base font-extrabold text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    {busy ? "Sending SOS..." : "Start 5s SOS Countdown"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={triggerSosNow}
                    className="min-h-[48px] rounded-lg border-2 border-red-800 bg-white px-4 py-3 text-sm font-bold text-red-900 hover:bg-red-50 disabled:opacity-60"
                  >
                    {t("sos.triggerNow")}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="space-y-2 rounded-lg border-2 border-red-700 bg-red-50 p-3 text-sm text-red-950">
              <p className="font-bold">{error}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`sms:?body=${smsFallbackBody}`}
                  className="inline-flex min-h-[44px] items-center rounded bg-slate-900 px-4 py-2 font-bold text-white"
                >
                  {t("sos.offlineSms")}
                </a>
                <button
                  type="button"
                  onClick={triggerSosNow}
                  className="min-h-[44px] rounded border-2 border-red-800 bg-white px-4 py-2 font-bold text-red-900"
                >
                  {t("sos.retry")}
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              role={statusIsWarning ? "alert" : "status"}
              className={`rounded-lg border p-3 text-sm font-semibold ${
                statusIsWarning
                  ? "border-amber-700 bg-amber-50 text-amber-950"
                  : "border-teal-700 bg-teal-50 text-teal-950"
              }`}
            >
              {statusMessage}
            </div>
          )}

          {sosResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-600">
                      {sosResult.sosEvent?.isDrill ? "TEST ALERT DRILL" : "SOS ACTIVE"}
                    </span>
                    <p className="text-base font-bold text-slate-950">
                      Status:{" "}
                      <span className="uppercase">{sosResult.sosEvent?.status}</span>
                    </p>
                  </div>
                  {sosResult.sosEvent?.acknowledgedAt && (
                    <span className="inline-flex items-center gap-1 rounded bg-green-100 px-3 py-1 text-sm font-bold text-green-950">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {t("sos.acknowledged")}
                    </span>
                  )}
                </div>

                {sosResult.trackingUrl && (
                  <p className="mt-2 break-all text-xs text-slate-700">
                    Tracking link (2h expiry):{" "}
                    <a href={sosResult.trackingUrl} className="font-semibold text-teal-900 underline">
                      {sosResult.trackingUrl}
                    </a>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {sosResult.sosEvent?.status !== "resolved" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={markSafe}
                      className="min-h-[44px] rounded-lg bg-green-800 px-4 py-2 text-sm font-bold text-white hover:bg-green-900"
                    >
                      {t("sos.imSafe")}
                    </button>
                  )}
                  <a
                    href={`sms:?body=${smsFallbackBody}`}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    {t("sos.offlineSms")}
                  </a>
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  {t("sos.nearestHospitals")}
                </h3>
                <div className="mt-2 space-y-2">
                  {(sosResult.hospitals || []).map((h) => (
                    <article key={h.id} className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-950">{h.name}</p>
                          <p className="text-xs text-slate-700">
                            {h.city} · {h.distanceKm ?? h.distance} km · {neededBedType} available:{" "}
                            <strong>{h.neededBedAvailable}</strong>
                          </p>
                        </div>
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-950">
                          Live
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/route?hospital=${encodeURIComponent(h.id)}`}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-[40px] items-center rounded border border-teal-800 px-3 py-1.5 text-xs font-bold text-teal-900"
                        >
                          Ambulance Route
                        </Link>
                        <Link
                          href={`/beds?hospitalId=${encodeURIComponent(h.id)}&requestBed=1&bedType=${encodeURIComponent(neededBedType)}`}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-[40px] items-center rounded bg-teal-800 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          {t("sos.oneTapRequest")}
                        </Link>
                        <button
                          type="button"
                          disabled={Boolean(preAlertedHospitals[h.id])}
                          onClick={() => preAlertHospital(h.id)}
                          className="min-h-[40px] rounded border border-amber-800 px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-60"
                        >
                          {preAlertedHospitals[h.id] ? "Pre-alerted" : t("sos.preAlertHospital")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </AccessibleModal>
    </>
  );
}
