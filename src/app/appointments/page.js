"use client";

import { useCallback, useEffect, useState } from "react";
import { appointmentDoctors as directoryDoctors } from "../../features/appointments/seed";
import { ensureSupabaseBrowser } from "../../lib/supabase/browser";
import { generatePdf } from "../../lib/generatePdf";
import { useRealtimeRefresh } from "../../lib/useRealtimeRefresh";
import LiveIndicator from "../../components/LiveIndicator";

export default function AppointmentsPage() {
  const [doctors, setDoctors] = useState(directoryDoctors);
  const [specialization, setSpecialization] = useState("");
  const [doctorId, setDoctorId] = useState(directoryDoctors[0].id);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [user, setUser] = useState(null);
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    ensureSupabaseBrowser().then((client) => {
      if (client) setSupabase(client);
    });
  }, []);

  const refreshAppointments = useCallback(async (clientOverride = null) => {
    const sb = clientOverride || supabase;
    const { data: sessionData } = (await sb?.auth.getSession()) || { data: { session: null } };
    if (!sessionData.session) return;
    try {
      const response = await fetch("/api/appointments", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load appointments.");
      setAppointments(result.appointments || []);
    } catch (error) {
      setStatus(`Could not refresh appointments: ${error.message}`);
      throw error;
    }
  }, [supabase]);

  const realtimeConnected = useRealtimeRefresh(
    user?.id ? [{ name: `patient-appointments-${user.id}`, private: true }] : [],
    refreshAppointments,
    15000,
  );
  const doctor = doctors.find((item) => item.id === doctorId) || doctors[0];
  const filteredDoctors = specialization
    ? doctors.filter((item) => (item.speciality || item.specialization) === specialization)
    : doctors;

  useEffect(() => {
    let active = true;
    async function load() {
      const sb = (await ensureSupabaseBrowser()) || supabase;
      if (sb && active) setSupabase(sb);
      const { data: sessionData } = (await sb?.auth.getSession()) || { data: { session: null } };
      const currentUser = sessionData.session?.user || null;
      if (active) setUser(currentUser);
      const doctorsResponse = await fetch("/api/doctors", { cache: "no-store" });
      const doctorsResult = await doctorsResponse.json();
      if (!doctorsResponse.ok) throw new Error(doctorsResult.error || "Could not load doctors.");
      const doctorRows = doctorsResult.doctors || [];
      if (doctorRows.length && active) {
        setDoctors(doctorRows.map((item) => ({
          ...item,
          specialization: item.speciality || item.specialization,
          hospital: item.hospital || "Swasth Saathi Partner Hospital",
        })));
        setDoctorId(doctorRows[0].id);
        setLive(doctorsResult.source === "prisma");
      }
      if (currentUser) {
        await refreshAppointments(sb);
      } else if (active) {
        const local = JSON.parse(localStorage.getItem("healthx_appointments") || "[]");
        if (local.length) setAppointments(local);
      }
    }
    load().catch((error) => { if (active) setStatus(`Could not load appointment data: ${error.message}`); });
    return () => { active = false; };
  }, [refreshAppointments]);

  async function book(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const { data: sessionData } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (sessionData.session) {
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
          body: JSON.stringify({
            patientName: sessionData.session.user.user_metadata?.display_name || sessionData.session.user.email || patientName || "Patient",
            doctorId,
            startsAt: new Date(`${date}T${time}:00`).toISOString(),
            mode: "in_person",
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Appointment booking failed.");
        setAppointments((items) => [result.appointment, ...items]);
        setStatus(`Appointment booked with ${doctor.name}. Status: ${result.appointment.status}.`);
        return;
      }
      const appointment = {
        id: `APT-${Date.now()}`,
        doctorId,
        doctor: doctor.name,
        hospital: doctor.hospital,
        date,
        time,
        status: "Confirmed",
        patient: patientName || "Account holder",
        createdAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("healthx_appointments") || "[]");
      localStorage.setItem("healthx_appointments", JSON.stringify([appointment, ...existing]));
      let note = `Appointment confirmed with ${doctor.name}.`;
      try {
        const response = await fetch("/api/dhrs/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: patientName || "Patient", doctorId, date, time }),
          cache: "no-store",
        });
        if (response.ok) note = `Appointment confirmed & synced with ${doctor.name}.`;
      } catch (error) {
        console.error("Optional DHRS adapter unavailable", error);
      }
      setAppointments((items) => [appointment, ...items]);
      setStatus(note);
    } catch (error) {
      console.error("Appointment booking failed", error);
      setStatus(`Appointment booking failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSlip(appointment) {
    try {
      const appointmentDoctor = appointment.doctors?.name || appointment.doctor || doctor.name;
      const starts = appointment.starts_at
        ? new Date(appointment.starts_at).toLocaleString()
        : `${appointment.date} ${appointment.time}`;
      await generatePdf({
        fileName: `${appointment.id}-appointment.pdf`,
        title: "Appointment slip",
        watermark: "Keep this slip for your hospital visit",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setFontSize(12);
          document.text(`Appointment: ${appointment.id}`, 16, 44);
          document.text(`Patient: ${appointment.patient || patientName || user?.user_metadata?.display_name || "Account holder"}`, 16, 54);
          document.text(`Doctor: ${appointmentDoctor}`, 16, 64);
          document.text(`Date and time: ${starts}`, 16, 74);
          document.text(`Status: ${appointment.status}`, 16, 84);
          document.text("Please confirm the appointment directly with the clinic.", 16, 100, { maxWidth: 175 });
          document.text("Swasth Saathi Care Portal — not a substitute for clinical advice.", 16, 115, { maxWidth: 175 });
        },
      });
    } catch (error) {
      console.error("Could not generate appointment PDF", error);
      setStatus("Could not generate appointment PDF. Please try again.");
    }
  }

  async function cancelAppointment(appointmentId) {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not cancel appointment.");
      setAppointments((items) => items.map((item) => item.id === appointmentId ? { ...item, status: "cancelled" } : item));
      setStatus("Appointment cancelled.");
    } catch (error) {
      setStatus(error.message || "Could not cancel appointment.");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="integrated-service-title text-3xl font-bold text-teal-900">Appointments</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={realtimeConnected} />
        <p className="text-slate-600">{live ? "Doctor directory and bookings use live cloud sync with Realtime updates." : "NMC-verified doctor directory connected for instant appointment scheduling."}</p>
      </div>
      {supabase && !user && <p className="mt-3 rounded bg-amber-50 p-3">Sign in to sync appointments to your cloud profile. <a className="underline" href="/auth">Sign in</a></p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <label className="block font-semibold">Specialization
            <select className="mt-1 block rounded border px-3 py-2" value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
              <option value="">All specialties</option>
              {[...new Set(doctors.map((item) => item.speciality || item.specialization))].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{filteredDoctors.map((item) => <button type="button" key={item.id} aria-pressed={doctorId === item.id} onClick={() => setDoctorId(item.id)} className={`rounded-lg border p-4 text-left ${doctorId === item.id ? "border-teal-800 bg-teal-50" : "bg-white"}`}>
            <strong>{item.name}</strong><span className="mt-1 block text-sm">{item.speciality || item.specialization} · {item.hospital}</span>
            <span className="mt-2 block text-sm">Languages: {item.languages?.join(", ") || "not listed"}</span>
            <span className="mt-2 block text-xs font-bold text-teal-900">NMC VERIFIED{item.registration_number ? ` · ${item.registration_number}` : ""}</span>
          </button>)}</div>
        </section>
        <form onSubmit={book} className="h-fit rounded-lg border bg-white p-5">
          <h2 className="text-lg font-bold">Book appointment</h2>
          {!user && <label className="mt-4 block">Patient name<input required autoComplete="name" className="mt-1 w-full rounded border px-3 py-2" value={patientName} onChange={(event) => setPatientName(event.target.value)} /></label>}
          <label className="mt-3 block">Date<input required min={today} type="date" className="mt-1 w-full rounded border px-3 py-2" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="mt-3 block">Time<input required type="time" className="mt-1 w-full rounded border px-3 py-2" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <button disabled={busy} className="mt-4 w-full rounded bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? "Saving..." : "Book appointment"}</button>
        </form>
      </div>
      {status && <p role="status" className="mt-5 rounded border border-teal-300 bg-teal-50 p-3">{status}</p>}
      <section className="mt-8"><h2 className="text-xl font-bold">Your appointments</h2><div className="mt-3 space-y-3">{appointments.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4"><div><h3 className="font-bold">{item.doctors?.name || item.doctor || "Appointment"}</h3><p className="text-sm">{item.starts_at ? new Date(item.starts_at).toLocaleString() : `${item.date} ${item.time}`} · {item.status}</p></div><div className="flex gap-2"><button onClick={() => downloadSlip(item)} className="rounded border border-teal-800 px-3 py-2">Download appointment PDF</button>{supabase && user && item.status !== "cancelled" && item.status !== "completed" && <button onClick={() => cancelAppointment(item.id)} className="rounded border border-red-700 px-3 py-2 text-red-900">Cancel</button>}</div></article>)}</div></section>
    </div>
  );
}
