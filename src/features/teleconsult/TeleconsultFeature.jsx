"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import demoDoctors from "./data/doctors.json";
import { getSupabaseBrowser } from "../../lib/supabase/browser";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import LiveIndicator from "../../components/LiveIndicator";

function mapDoctor(doctor) {
  return {
    ...doctor,
    specialization: doctor.speciality || doctor.specialization,
    availability: doctor.availability_slots || doctor.availability || [],
    modes: doctor.modes || ["Video", "Audio", "Chat"],
    wheelchairClinic: doctor.wheelchairClinic ?? false,
  };
}

export default function TeleconsultFeature() {
  const [doctors, setDoctors] = useState(demoDoctors);
  const [selected, setSelected] = useState(demoDoctors[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState("video");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [appointment, setAppointment] = useState(null);
  const [roomUrl, setRoomUrl] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [booking, setBooking] = useState(false);
  const [specialityFilter, setSpecialityFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const roomSectionRef = useRef(null);
  const supabase = getSupabaseBrowser();
  const refreshAppointmentStatus = useCallback(async () => {
    if (!appointment?.id || appointment.demo) return;
    const { data } = await supabase?.auth.getSession() || { data: { session: null } };
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
  }, [appointment?.id, appointment?.demo, supabase]);
  const realtimeConnected = useRealtimeRefresh(
    appointment?.id && !appointment.demo ? [{ name: `appointment-${appointment.id}`, private: true }] : [],
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
          if (result.source === "prisma") setMessage("");
          else setMessage("Showing clearly marked demo doctors; live doctor records require Prisma setup.");
        }
      } catch (error) {
        console.error("Could not load doctor directory", error);
        if (active) setMessage("Could not load the doctor directory. Showing cached demo listings.");
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
    if (!date || !time || !name) {
      setMessage("Enter patient name, date and time.");
      return;
    }
    setBooking(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase?.auth.getSession() || { data: { session: null } };
      if (sessionData.session) {
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
          body: JSON.stringify({
            patientName: name,
            doctorId: selected.id,
            startsAt: new Date(`${date}T${time}:00`).toISOString(),
            mode: mode.toLowerCase(),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Appointment booking failed.");
        setAppointment({ ...result.appointment, doctor: selected.name, specialization: selected.specialization, patient: name });
        setMessage(`Appointment booked. Status: ${result.appointment.status}.`);
      } else {
        const id = `apt-${selected.id}-${date}-${time.replace(":", "")}`;
        const bookingData = {
          id, doctorId: selected.id, doctor: selected.name, specialization: selected.specialization,
          patient: name, date, time, mode, status: "Confirmed demo", demo: true,
          room_name: `SwasthSaathi-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        };
        const bookings = JSON.parse(localStorage.getItem("healthx_appointments") || "[]");
        localStorage.setItem("healthx_appointments", JSON.stringify([bookingData, ...bookings]));
        setAppointment(bookingData);
        setMessage(`Demo appointment saved locally: ${id}.`);
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
      if (appointment?.demo || !supabase) {
        let jaasUrl = null;
        try {
          const configRes = await fetch("/api/teleconsult/room-token", { cache: "no-store" });
          if (configRes.ok) {
            const config = await configRes.json();
            if (config?.appId && config?.demoToken) {
              jaasUrl = `https://8x8.vc/${encodeURIComponent(config.appId)}/${encodeURIComponent(appointment.room_name)}?jwt=${encodeURIComponent(config.demoToken)}`;
            }
          }
        } catch {
          jaasUrl = null;
        }
        setRoomUrl(
          jaasUrl || `https://meet.jit.si/${encodeURIComponent(appointment.room_name)}`,
        );
        return;
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

  const today = new Date().toISOString().slice(0, 10);
  const specialities = [...new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))];
  const languages = [...new Set(doctors.flatMap((doctor) => doctor.languages || []))].sort();
  const visibleDoctors = doctors.filter((doctor) =>
    (!specialityFilter || doctor.specialization === specialityFilter) &&
    (!languageFilter || doctor.languages?.includes(languageFilter)));
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="service-mast"><h1 className="text-3xl font-bold text-teal-900">Teleconsultation</h1></header>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-amber-950">
        {supabase ? "Live booking requires an authenticated patient account. Secure video requires JaaS configuration." : "Demo doctors, local appointments, and a public Jitsi demo room. Do not share private medical information in demo rooms."}
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
            <p className="mt-2 text-sm">Languages: {doctor.languages?.join(", ")}</p>
            <p className="text-sm">{doctor.fee ? `Consultation fee: ₹${doctor.fee}` : "Consultation fee: not provided"}</p>
            {doctor.registration_number && <p className="text-sm">Registration: {doctor.registration_number}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {doctor.signLanguage && <span className="rounded bg-blue-100 px-2 py-1 text-xs">Sign language support</span>}
              {doctor.wheelchairClinic && <span className="rounded bg-green-100 px-2 py-1 text-xs">Wheelchair-friendly clinic</span>}
              <span className={`rounded px-2 py-1 text-xs ${doctor.demo ? "bg-amber-100" : "bg-green-100"}`}>{doctor.demo ? "Demo listing" : "Directory listing"}</span>
            </div>
            <button type="button" onClick={() => { setSelected(doctor); setTime(""); }} className="mt-4 rounded border border-teal-800 px-3 py-2 text-sm">Choose doctor</button>
          </article>)}
          {!loadingDoctors && visibleDoctors.length === 0 && <p role="status">No doctors match these filters.</p>}
          </div>
        </section>
        <aside className="rounded-lg border bg-white p-5">
          <h2 className="text-xl font-bold">Book with {selected.name}</h2>
          <form onSubmit={book} className="mt-4 space-y-3">
            <label className="block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="block">Date<input required min={today} type="date" className="mt-1 w-full rounded border px-3 py-2" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <fieldset><legend>Time slot</legend><div className="mt-2 flex flex-wrap gap-2">{selected.availability.map((slot) => <button type="button" key={slot} aria-pressed={time === slot} onClick={() => setTime(slot)} className={`rounded border px-3 py-2 ${time === slot ? "bg-teal-800 text-white" : "bg-white"}`}>{slot}</button>)}</div></fieldset>
            <label className="block">Mode<select className="mt-1 w-full rounded border px-3 py-2" value={mode} onChange={(event) => setMode(event.target.value)}>{selected.modes.map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}</select></label>
            <button disabled={booking || loadingDoctors} className="w-full rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-60">{booking ? "Booking..." : supabase ? "Book appointment" : "Book demo appointment"}</button>
          </form>
          {message && <p role="status" className="mt-4 rounded bg-green-50 p-3 text-sm">{message}</p>}
          {appointment && <section className="mt-5 border-t pt-4"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">Appointment details</h3>{!appointment.demo&&<LiveIndicator connected={realtimeConnected}/>}</div><p className="text-sm">{appointment.doctor} · {new Date(appointment.starts_at || `${appointment.date}T${appointment.time}`).toLocaleString()} · Status: {appointment.status}</p><button onClick={joinRoom} className="mt-3 rounded bg-teal-800 px-3 py-2 text-white">Join consultation</button></section>}
        </aside>
      </div>
      {roomUrl && (
        <section ref={roomSectionRef} className="mt-6 rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              {appointment?.demo
                ? "Public demo Jitsi room — do not discuss personal health information"
                : "Private appointment room"}
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
