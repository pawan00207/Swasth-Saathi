"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import directoryDoctors from "./data/doctors.json";
import { ensureSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import LiveIndicator from "../../components/LiveIndicator";

function loadRazorpayCheckout() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded."));
    document.body.appendChild(script);
  });
}

function mapDoctor(doctor) {
  const slots = doctor.availabilitySlots ?? doctor.availability_slots ?? doctor.availability;
  return {
    ...doctor,
    specialization: doctor.speciality || doctor.specialization,
    availability: Array.isArray(slots) ? slots.filter((slot) => typeof slot === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot)) : [],
    modes: doctor.modes || ["Video", "Audio", "Chat"],
    wheelchairClinic: doctor.wheelchairClinic ?? false,
  };
}

export default function TeleconsultFeature() {
  const [doctors, setDoctors] = useState(directoryDoctors);
  const [selected, setSelected] = useState(directoryDoctors[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState("video");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [appointment, setAppointment] = useState(null);
  const [privateRoomsConfigured, setPrivateRoomsConfigured] = useState(false);
  const [roomUrl, setRoomUrl] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [booking, setBooking] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);
  const [specialityFilter, setSpecialityFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [supabase, setSupabase] = useState(null);
  const roomSectionRef = useRef(null);

  useEffect(() => {
    ensureSupabaseBrowser().then((client) => {
      if (client) setSupabase(client);
    });
    fetch("/api/teleconsult/room-token", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setPrivateRoomsConfigured(Boolean(config?.privateRoomsConfigured)))
      .catch(() => {});
    fetch("/api/public-config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => setRazorpayConfigured(Boolean(config?.razorpayConfigured)))
      .catch((error) => console.error("Could not check Razorpay configuration", error));
  }, []);

  const refreshAppointmentStatus = useCallback(async () => {
    if (!appointment?.id || appointment.localOnly) return;
    const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
    if (!data.session) return;
    const response = await fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not refresh appointment status.");
    const updated = result.appointments?.find((item) => item.id === appointment.id);
    if (updated) {
      setAppointment((current) => ({ ...current, ...updated }));
      if (updated.status === "cancelled") setRoomUrl("");
    }
  }, [appointment?.id, appointment?.localOnly, supabase]);

  const realtimeConnected = useRealtimeRefresh(
    appointment?.id && !appointment.localOnly ? [{ name: `appointment-${appointment.id}`, private: true }] : [],
    refreshAppointmentStatus,
    15000,
  );

  useEffect(() => {
    let active = true;
    async function loadDoctors() {
      try {
        const response = await fetch("/api/doctors", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load doctors.");
        if (!active) return;
        if (result.doctors?.length) {
          const liveDoctors = result.doctors.map(mapDoctor);
          setDoctors(liveDoctors);
          setSelected(liveDoctors[0]);
          setMessage("");
        }
      } catch (error) {
        console.error("Could not load doctor directory", error);
        if (active) setMessage("Showing cached NMC doctor directory.");
      } finally {
        if (active) setLoadingDoctors(false);
      }
    }
    loadDoctors();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (roomUrl) {
      roomSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [roomUrl]);

  async function book(event) {
    event.preventDefault();
    const startsAt = new Date(`${date}T${time}:00`);
    if (!date || !availableSlots.includes(time) || !name.trim() || !(startsAt > new Date())) {
      setMessage("Enter the patient name and choose a future time slot.");
      return;
    }
    setBooking(true);
    setMessage("");
    try {
      const { data: sessionData } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (sessionData.session) {
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
          body: JSON.stringify({
            patientName: name,
            doctorId: selected.id,
            startsAt: startsAt.toISOString(),
            mode: mode.toLowerCase(),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Appointment booking failed.");
        setRoomUrl("");
        setAppointment({
          ...result.appointment,
          doctor: selected.name,
          specialization: selected.specialization,
          consultationFee: Number(selected.fee || 0),
          patient: name,
        });
        setMessage(`Appointment booked. Status: ${result.appointment.status}.`);
      } else {
        const id = `APT-${selected.id.toUpperCase()}-${date.replace(/-/g, "")}-${time.replace(":", "")}`;
        const bookingData = {
          id,
          doctorId: selected.id,
          doctor: selected.name,
          specialization: selected.specialization,
          patient: name,
          date,
          time,
          mode,
          consultationFee: Number(selected.fee || 0),
          status: "Saved locally",
          localOnly: true,
          room_name: `SwasthSaathi-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        };
        const bookings = JSON.parse(localStorage.getItem("healthx_appointments") || "[]");
        localStorage.setItem("healthx_appointments", JSON.stringify([bookingData, ...bookings]));
        setRoomUrl("");
        setAppointment(bookingData);
        setMessage(`Saved on this device. Sign in to book a shared appointment.`);
      }
    } catch (error) {
      console.error("Appointment booking failed", error);
      setMessage(`Appointment booking failed: ${error.message}`);
    } finally {
      setBooking(false);
    }
  }

  async function joinRoom() {
    try {
      if (!appointment || appointment.localOnly || !supabase) {
        throw new Error("Sign in and book online to join a private 8x8 consultation.");
      }
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/teleconsult/room-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ appointmentId: appointment.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not join secure consultation.");
      setRoomUrl(`https://8x8.vc/${result.appId}/${result.room}?jwt=${encodeURIComponent(result.token)}`);
    } catch (reason) {
      setMessage(reason.message || "Could not join secure consultation.");
    }
  }

  async function payConsultationFee() {
    if (!appointment?.id || appointment.localOnly || !supabase) {
      setMessage("Sign in to pay for this consultation.");
      return;
    }

    setPaymentBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      };
      const orderResponse = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}/payment`, {
        method: "POST",
        headers,
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not create consultation payment.");

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Swasth Saathi Teleconsultation",
        description: `Consultation with ${appointment.doctor || selected.name}`,
        handler: async (result) => {
          try {
            const verifyResponse = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers,
              body: JSON.stringify({
                billId: order.billId,
                orderId: result.razorpay_order_id,
                paymentId: result.razorpay_payment_id,
                signature: result.razorpay_signature,
              }),
            });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verification.error || "Payment verification failed.");
            setMessage(`Consultation fee paid successfully (₹${order.total}).`);
          } catch (error) {
            setMessage(error.message || "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: () => setMessage("Payment window closed. You can retry payment from this appointment."),
        },
      });
      checkout.on("payment.failed", () => setMessage("Payment failed. You can retry payment from this appointment."));
      checkout.open();
    } catch (error) {
      setMessage(error.message || "Could not start consultation payment.");
    } finally {
      setPaymentBusy(false);
    }
  }

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const availableSlots = selected.availability.filter((slot) => !date || new Date(`${date}T${slot}:00`) > now);
  const specialities = [...new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))];
  const languages = [...new Set(doctors.flatMap((doctor) => doctor.languages || []))].sort();
  const appointmentFee = Number(appointment?.consultationFee ?? selected.fee ?? 0);
  const visibleDoctors = doctors.filter((doctor) =>
    (!specialityFilter || doctor.specialization === specialityFilter) &&
    (!languageFilter || doctor.languages?.includes(languageFilter)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="integrated-service-title text-3xl font-bold text-teal-900">Teleconsultation</h1>
      <p className="mt-2 rounded border border-teal-300 bg-teal-50 p-3 text-teal-950">
        Sign in to book online. Consultations use private 8x8 Jitsi rooms.
        {" "}This service is not emergency triage or a substitute for medical advice.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-label="Doctors">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label>Specialty<select className="mt-1 w-full rounded border px-3 py-2" value={specialityFilter} onChange={(event) => setSpecialityFilter(event.target.value)}><option value="">All specialties</option>{specialities.map((speciality) => <option key={speciality}>{speciality}</option>)}</select></label>
            <label>Language<select className="mt-1 w-full rounded border px-3 py-2" value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}><option value="">All languages</option>{languages.map((language) => <option key={language}>{language}</option>)}</select></label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          {visibleDoctors.map((doctor) => <article key={doctor.id} className={`rounded-lg border bg-white p-5 ${selected.id === doctor.id ? "ring-2 ring-teal-700" : ""}`}>
            <h2 className="text-lg font-bold">{doctor.name}</h2>
            <p>{doctor.specialization}</p>
            {doctor.hospital && <p className="text-xs text-slate-600">{doctor.hospital}</p>}
            <p className="mt-2 text-sm">Languages: {doctor.languages?.join(", ")}</p>
            <p className="text-sm">{doctor.fee ? `Consultation fee: ₹${doctor.fee}` : "Consultation fee: not provided"}</p>
            {doctor.registration_number && <p className="text-sm">Registration: {doctor.registration_number}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {doctor.signLanguage && <span className="rounded bg-blue-100 px-2 py-1 text-xs">Sign language support</span>}
              {doctor.wheelchairClinic && <span className="rounded bg-green-100 px-2 py-1 text-xs">Wheelchair-friendly clinic</span>}
              <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-900">NMC Verified</span>
            </div>
            <button type="button" onClick={() => { setSelected(doctor); setTime(""); setMode(doctor.modes[0]?.toLowerCase() || "video"); }} className="mt-4 rounded border border-teal-800 px-3 py-2 text-sm">Choose doctor</button>
          </article>)}
          {!loadingDoctors && visibleDoctors.length === 0 && <p role="status">No doctors match these filters.</p>}
          </div>
        </section>
        <aside className="rounded-lg border bg-white p-5">
          <h2 className="text-xl font-bold">Book with {selected.name}</h2>
          <form onSubmit={book} className="mt-4 space-y-3">
            <label className="block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="block">Date<input required min={today} type="date" className="mt-1 w-full rounded border px-3 py-2" value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></label>
            <fieldset><legend>Time slot</legend><div className="mt-2 flex flex-wrap gap-2">{availableSlots.map((slot) => <button type="button" key={slot} aria-pressed={time === slot} onClick={() => setTime(slot)} className={`rounded border px-3 py-2 ${time === slot ? "bg-teal-800 text-white" : "bg-white"}`}>{slot}</button>)}</div>{!availableSlots.length && <p role="status" className="text-sm text-slate-600">No available times. Try another date or doctor.</p>}</fieldset>
            <label className="block">Mode<select className="mt-1 w-full rounded border px-3 py-2" value={mode} onChange={(event) => setMode(event.target.value)}>{selected.modes.map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}</select></label>
            <button disabled={booking || loadingDoctors || !availableSlots.includes(time)} className="w-full rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-60">{booking ? "Booking..." : "Book appointment"}</button>
          </form>
          {message && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm">{message}</p>}
          {appointment && <section className="mt-5 border-t pt-4"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">Appointment details</h3>{!appointment.localOnly && <LiveIndicator connected={realtimeConnected} />}</div><p className="text-sm">{appointment.doctor} · {new Date(appointment.starts_at || `${appointment.date}T${appointment.time}`).toLocaleString()} · Status: {appointment.status}</p>{appointmentFee > 0 && (appointment.localOnly ? <p className="mt-3 text-sm text-slate-600">Sign in and book a cloud appointment to pay the consultation fee securely.</p> : razorpayConfigured ? <button type="button" disabled={paymentBusy} onClick={payConsultationFee} className="mt-3 rounded border border-teal-800 px-3 py-2 font-semibold text-teal-900 disabled:opacity-60">{paymentBusy ? "Starting payment..." : `Pay consultation fee (₹${appointmentFee})`}</button> : <p role="status" className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Razorpay checkout is not configured. Add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to server-side <code>.env.local</code>, then restart the app.</p>)}{appointment.localOnly ? <p className="mt-3 text-sm">Sign in and book online to join.</p> : privateRoomsConfigured ? <button onClick={joinRoom} disabled={appointment.status === "cancelled"} className="mt-3 rounded bg-teal-800 px-3 py-2 text-white disabled:opacity-60">Join consultation</button> : <p role="status" className="mt-3 text-sm">Private video is unavailable until 8x8 Jitsi is configured.</p>}</section>}
        </aside>
      </div>
      {roomUrl && (
        <section ref={roomSectionRef} className="mt-6 rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              Private 8x8 appointment room
            </h2>
            <a
              href={roomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-teal-800 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            >
              Open room in new tab
            </a>
          </div>
          <iframe
            title="Teleconsultation video room"
            referrerPolicy="no-referrer"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="mt-3 h-[480px] w-full rounded border"
            src={roomUrl}
          />
        </section>
      )}
    </div>
  );
}
