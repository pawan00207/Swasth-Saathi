"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Link2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Upload,
} from "lucide-react";

const HI_TYPES = [
  "DiagnosticReport",
  "Prescription",
  "OPConsultation",
  "DischargeSummary",
  "ImmunizationRecord",
];

function formatMaskedAadhaarInput(value) {
  return value.replace(/[^\d]/g, "").slice(0, 12);
}

export default function AbdmPage() {
  const [status, setStatus] = useState(null);
  const [identifier, setIdentifier] = useState("aarav.sharma@abdm");
  const [lookupResult, setLookupResult] = useState(null);
  const [selectedHiTypes, setSelectedHiTypes] = useState(["DiagnosticReport", "Prescription"]);
  const [consentResult, setConsentResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [error, setError] = useState("");

  // Aadhaar Verification state
  const [aadhaarDigits, setAadhaarDigits] = useState("");
  const [aadhaarChallenge, setAadhaarChallenge] = useState(null);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(null);
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarError, setAadhaarError] = useState("");

  // Face Verification state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedSelfie, setCapturedSelfie] = useState("");
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceResult, setFaceResult] = useState(null);
  const [faceError, setFaceError] = useState("");

  useEffect(() => {
    fetch("/api/abdm/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function verifyAbha(event) {
    event?.preventDefault?.();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/abdm/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not verify ABHA profile.");
      setLookupResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    verifyAbha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleHiType(type) {
    setSelectedHiTypes((curr) =>
      curr.includes(type) ? curr.filter((item) => item !== type) : [...curr, type],
    );
  }

  async function requestConsent() {
    const abhaAddress = lookupResult?.profile?.abhaAddress || identifier;
    setConsentBusy(true);
    setError("");
    try {
      const res = await fetch("/api/abdm/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abhaAddress, hiTypes: selectedHiTypes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not initiate ABDM consent request.");
      setConsentResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setConsentBusy(false);
    }
  }

  async function sendAadhaarOtp(event) {
    event.preventDefault();
    setAadhaarBusy(true);
    setAadhaarError("");
    setAadhaarVerified(null);
    try {
      const res = await fetch("/api/abdm/aadhaar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_otp", aadhaarNumber: aadhaarDigits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send Aadhaar OTP.");
      setAadhaarChallenge(data);
      setAadhaarOtp("");
    } catch (err) {
      setAadhaarError(err.message);
    } finally {
      setAadhaarBusy(false);
    }
  }

  async function verifyAadhaarOtp(event) {
    event.preventDefault();
    if (!aadhaarChallenge) return;
    setAadhaarBusy(true);
    setAadhaarError("");
    try {
      const res = await fetch("/api/abdm/aadhaar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          otp: aadhaarOtp,
          txnId: aadhaarChallenge.txnId,
          maskedAadhaar: aadhaarChallenge.maskedAadhaar,
          challengeToken: aadhaarChallenge.challengeToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.error || "OTP verification failed.");
      setAadhaarVerified(data);
      setAadhaarDigits("");
    } catch (err) {
      setAadhaarError(err.message);
    } finally {
      setAadhaarBusy(false);
    }
  }

  async function startCamera() {
    setCameraError("");
    setFaceError("");
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError("Camera API unavailable in this browser. Upload a selfie image instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError("Camera permission denied or unavailable. You can upload a selfie photo below.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function snapSelfie() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedSelfie(dataUrl);
    setFaceResult(null);
    stopCamera();
  }

  function handleSelfieUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFaceError("");
    setFaceResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedSelfie(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function runFaceVerification() {
    if (!capturedSelfie) {
      setFaceError("Capture a camera photo or upload a selfie first.");
      return;
    }
    setFaceBusy(true);
    setFaceError("");
    try {
      const res = await fetch("/api/abdm/face-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: capturedSelfie,
          abhaIdentifier: lookupResult?.profile?.abhaAddress || identifier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.error || "Face verification failed.");
      setFaceResult(data);
    } catch (err) {
      setFaceError(err.message);
    } finally {
      setFaceBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            Ayushman Bharat Digital Mission · HIE-CM &amp; e-KYC
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            <ShieldCheck className="h-7 w-7 text-teal-800" aria-hidden="true" />
            <span>ABDM &amp; ABHA Health Exchange</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Real-time ABHA lookup, Aadhaar Verhoeff e-KYC OTP verification, live selfie face verification, and FHIR consent sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800">
              {status.liveConnected ? "ABDM Gateway: LIVE" : `ABDM CM: ${status.cmId?.toUpperCase() || "READY"}`}
            </span>
          )}
          {lookupResult?.checkedAt && (
            <span className="tabular-nums rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              Fetched {new Date(lookupResult.checkedAt).toLocaleTimeString()} ({lookupResult.latencyMs ?? 0}ms)
            </span>
          )}
        </div>
      </div>

      {status?.milestones && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="ABDM Milestones">
          {status.milestones.map((m) => (
            <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <strong className="font-mono text-teal-900">{m.id}</strong>
                <span className="font-bold uppercase text-green-700">{m.status}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">{m.name}</p>
            </article>
          ))}
        </section>
      )}

      {/* Real-time ABHA Lookup */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-950">Real-Time ABHA Address / 14-digit Number Lookup</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => verifyAbha()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sync Live</span>
          </button>
        </div>
        <form onSubmit={verifyAbha} className="mt-3 flex flex-wrap gap-3">
          <input
            required
            aria-label="ABHA Address or Number"
            placeholder="e.g. aarav.sharma@abdm or 91-4821-7734-9012"
            className="min-h-[42px] min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[42px] rounded-lg bg-teal-800 px-5 py-2 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"
          >
            {busy ? "Fetching..." : "Verify & Fetch ABHA"}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">{error}</p>}
      </section>

      {/* Aadhaar e-KYC + Face Biometric Verification */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <Fingerprint className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <span>Aadhaar e-KYC Verification</span>
            </h2>
            {aadhaarVerified && (
              <span className="text-xs font-bold uppercase text-green-700">
                UIDAI Verified · {aadhaarVerified.maskedAadhaar}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Validates 12-digit Aadhaar checksum (Verhoeff) and verifies OTP via ABDM e-KYC. Raw Aadhaar digits are never stored or echoed back.
          </p>

          <form onSubmit={sendAadhaarOtp} className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              required
              aria-label="12-digit Aadhaar Number"
              placeholder="Enter 12-digit Aadhaar number"
              className="font-mono min-h-[40px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={aadhaarDigits}
              onChange={(e) => setAadhaarDigits(formatMaskedAadhaarInput(e.target.value))}
            />
            <button
              type="submit"
              disabled={aadhaarBusy || aadhaarDigits.length !== 12}
              className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {aadhaarBusy ? "Sending..." : "Send Aadhaar OTP"}
            </button>
          </form>

          {aadhaarChallenge && !aadhaarVerified && (
            <form onSubmit={verifyAadhaarOtp} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-medium text-slate-700">
                {aadhaarChallenge.message}
                {aadhaarChallenge.sandboxOtp && (
                  <span className="ml-2 font-mono font-bold text-teal-900">
                    (Verification OTP: {aadhaarChallenge.sandboxOtp})
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  aria-label="6-digit Aadhaar OTP"
                  placeholder="Enter 6-digit OTP"
                  className="font-mono min-h-[38px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  value={aadhaarOtp}
                  onChange={(e) => setAadhaarOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                />
                <button
                  type="submit"
                  disabled={aadhaarBusy || aadhaarOtp.length !== 6}
                  className="min-h-[38px] rounded-lg bg-teal-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
                >
                  Verify OTP
                </button>
              </div>
            </form>
          )}

          {aadhaarVerified && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs text-green-900">
              <p className="font-bold">Aadhaar e-KYC Verified ({aadhaarVerified.maskedAadhaar})</p>
              <p className="mt-1 font-mono">
                Ref: {aadhaarVerified.aadhaarRef || aadhaarVerified.txnId} · {new Date(aadhaarVerified.verifiedAt).toLocaleString()}
              </p>
            </div>
          )}

          {aadhaarError && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900">
              {aadhaarError}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <ScanFace className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <span>Face Biometric Verification</span>
            </h2>
            {faceResult?.verified && (
              <span className="tabular-nums text-xs font-bold uppercase text-green-700">
                Verified · {faceResult.confidenceScore}% match
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Capture a live selfie or upload a portrait photo to run server-side liveness &amp; facial presence verification for ABHA KYC.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Start Live Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={snapSelfie}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-900"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Capture Selfie</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-[38px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Stop Camera
                </button>
              </>
            )}

            <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Selfie</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleSelfieUpload} />
            </label>
          </div>

          {cameraError && (
            <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950">
              {cameraError}
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-950 ${cameraActive ? "block" : "hidden"}`}>
              <video ref={videoRef} playsInline muted className="h-44 w-full object-cover" />
            </div>
            {capturedSelfie && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                <img src={capturedSelfie} alt="Captured selfie preview" className="h-40 w-full rounded object-cover" />
              </div>
            )}
          </div>

          {capturedSelfie && (
            <button
              type="button"
              disabled={faceBusy}
              onClick={runFaceVerification}
              className="mt-3 min-h-[40px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
            >
              {faceBusy ? "Verifying Face Biometrics..." : "Run Face Verification"}
            </button>
          )}

          {faceResult?.verified && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3.5 text-xs text-green-900">
              <p className="font-bold">
                {faceResult.livenessStatus} · Confidence {faceResult.confidenceScore}%
              </p>
              <p className="mt-1">{faceResult.summary}</p>
              <p className="mt-1 font-mono text-[11px]">
                Token: {faceResult.verificationId} · Digest: {faceResult.biometricDigest}
              </p>
            </div>
          )}

          {faceError && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900">
              {faceError}
            </p>
          )}
        </section>
      </div>

      {/* Verified ABHA Profile & HIU Consent */}
      {lookupResult?.profile && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-950">Verified ABHA Profile</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lookupResult.profile.verificationStatus || "VERIFIED"}</span>
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Full Name</dt>
                <dd className="font-semibold text-slate-950">{lookupResult.profile.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">ABHA Address</dt>
                <dd className="font-semibold text-teal-900">{lookupResult.profile.abhaAddress}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">ABHA Number</dt>
                <dd className="font-mono text-slate-900">{lookupResult.profile.abhaNumber}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Location / YOB</dt>
                <dd className="tabular-nums text-slate-900">
                  {lookupResult.profile.districtName}, {lookupResult.profile.stateName} · {lookupResult.profile.yearOfBirth}
                </dd>
              </div>
            </dl>

            <h3 className="mt-6 flex items-center gap-1.5 text-sm font-bold text-slate-950">
              <Link2 className="h-4 w-4 text-teal-800" aria-hidden="true" />
              <span>Linked Hospital Care Contexts</span>
            </h3>
            <div className="mt-3 space-y-2.5">
              {(lookupResult.careContexts || []).map((cc) => (
                <article key={cc.referenceNumber} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-slate-950">{cc.hospitalName}</strong>
                    <span className="font-mono font-semibold text-teal-900">HIP: {cc.hipId}</span>
                  </div>
                  <p className="mt-1 font-medium text-slate-800">{cc.display}</p>
                  <p className="mt-1 text-slate-500">
                    Ref: {cc.referenceNumber} · {cc.doctor} · Synced {new Date(cc.lastSyncedAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <FileCheck2 className="h-5 w-5 text-teal-800" aria-hidden="true" />
              <span>Request Health Records (HIU Consent)</span>
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Select FHIR health information types to fetch from linked ABDM hospitals.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {HI_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selectedHiTypes.includes(type)}
                  onClick={() => toggleHiType(type)}
                  className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-bold ${
                    selectedHiTypes.includes(type)
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-slate-300 bg-white text-slate-800"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={consentBusy || selectedHiTypes.length === 0}
              onClick={requestConsent}
              className="mt-4 min-h-[42px] rounded-lg bg-teal-800 px-5 py-2 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-60"
            >
              {consentBusy ? "Requesting Consent..." : "Create ABDM Consent Request"}
            </button>

            {consentResult && (
              <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                <p className="font-bold text-green-950">
                  Consent Status: {consentResult.status} · Request #{consentResult.requestId.slice(0, 12)}
                </p>
                {consentResult.consentArtefactId && (
                  <p className="mt-1 text-xs text-green-900">
                    Artefact ID: {consentResult.consentArtefactId} · Expires {new Date(consentResult.expiresAt).toLocaleDateString()}
                  </p>
                )}
                {consentResult.fhirBundleSummary?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {consentResult.fhirBundleSummary.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-green-200 bg-white p-3">
                        <p className="font-bold text-slate-950">
                          {item.resourceType}: {item.title}
                        </p>
                        <p className="text-xs text-slate-600">
                          {item.facility} · {new Date(item.issued).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-slate-800">{item.conclusion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
