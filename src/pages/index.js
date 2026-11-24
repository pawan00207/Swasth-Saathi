import React, { useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  FileHeart,
  HeartPulse,
  Landmark,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";
import SelectType from "@/components/form/selectType";
import EnterDetails from "@/components/form/EnterDetails";
import CreateDid from "@/components/form/createDid";

const MODULES = [
  {
    href: "/patient",
    title: "Patient Health Hub",
    desc: "Medical history, saved hospital preferences & past bed requests synced via Supabase.",
    icon: FileHeart,
  },
  {
    href: "/beds",
    title: "Live ICU & Oxygen Beds",
    desc: "Real-time hospital bed availability, Telegram alerts & one-tap bed requests.",
    icon: BedDouble,
  },
  {
    href: "/billing",
    title: "Care Wallet (Razorpay)",
    desc: "Settle hospital bills for any hospital with GST breakdowns, QR verification & PDFs.",
    icon: Wallet,
  },
  {
    href: "/abdm",
    title: "ABDM, Aadhaar & Face KYC",
    desc: "Real-time ABHA lookup, Aadhaar OTP e-KYC verification & live selfie face check.",
    icon: ShieldCheck,
  },
  {
    href: "/schemes",
    title: "Government Schemes",
    desc: "Filter 24+ PM-JAY, disability & state health schemes with direct official portal links.",
    icon: Landmark,
  },
  {
    href: "/route",
    title: "Accessible Routing",
    desc: "Wheelchair, ramp & elevator-verified hospital navigation powered by OSRM & OSM.",
    icon: MapPin,
  },
  {
    href: "/consult",
    title: "Teleconsultation",
    desc: "Connect with verified doctors via video/audio consults and digital prescriptions.",
    icon: Stethoscope,
  },
  {
    href: "/sos",
    title: "SOS & Emergency Card",
    desc: "Instant emergency dispatch to contacts & Telegram admins with scannable QR card.",
    icon: ShieldAlert,
  },
];

export default function HomePage() {
  const [type, setType] = useState("");
  const [details, setDetails] = useState({ name: "", year: "" });
  const [step, setStep] = useState(0);

  return (
    <div className="swasth-canvas min-h-screen text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white">
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Swasth Saathi</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <Link href="/patient" className="rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100">Patient Hub</Link>
            <Link href="/beds" className="rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100">Beds</Link>
            <Link href="/billing" className="rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100">Care Wallet</Link>
            <Link href="/abdm" className="rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100">ABDM / ABHA</Link>
            <Link href="/schemes" className="rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100">Schemes</Link>
            <Link href="/auth" className="rounded-lg bg-teal-800 px-3.5 py-1.5 font-bold text-white hover:bg-teal-900">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 space-y-10">
        <section className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Accessible Digital Healthcare Network · India
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Unified Care Records, Live Hospital Beds &amp; Instant Care Wallet
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Manage your ABDM / ABHA records with Aadhaar &amp; Face verification, book accessible beds,
              settle bills across any hospital with Razorpay, and unlock verified government health schemes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/patient"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-900"
              >
                Open Patient Health Hub
              </Link>
              <Link
                href="/beds"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Check Live Beds
              </Link>
              <Link
                href="/billing"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Settle Hospital Bill
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-teal-900">
                Web5 DID Health Vault Onboarding
              </span>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="text-xs font-semibold text-slate-600 hover:underline"
                >
                  Start Over
                </button>
              )}
            </div>
            {step === 0 && <SelectType setType={setType} setStep={setStep} embedded />}
            {step === 1 && (
              <EnterDetails type={type} setDetails={setDetails} setStep={setStep} embedded />
            )}
            {step === 2 && (
              <CreateDid name={details.name} year={details.year} userType={type} embedded />
            )}
          </div>
        </section>

        <section aria-label="Healthcare Services">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-950">Healthcare Platform Modules</h2>
            <Link href="/dashboard" className="text-xs font-bold text-teal-800 hover:underline">
              Open DID Vault Dashboard →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ href, title, desc, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-800">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-950 group-hover:text-teal-900">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
