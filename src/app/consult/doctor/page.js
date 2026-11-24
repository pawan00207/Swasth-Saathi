"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseBrowser } from "../../../lib/supabase/browser";
import { generatePdf } from "../../../lib/generatePdf";
import { useRealtimeRefresh } from "../../../lib/useRealtimeRefresh";
import LiveIndicator from "../../../components/LiveIndicator";

export default function DoctorDashboard() {
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState(false);
  const [roomUrl, setRoomUrl] = useState("");
  const [prescriptionAppointment, setPrescriptionAppointment] = useState(null);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [prescriptionBusy, setPrescriptionBusy] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [realtimeTopic, setRealtimeTopic] = useState("");
  const [supabase, setSupabase] = useState(null);

  const refreshLive = useCallback(async (token = accessToken) => {
    if (!token) return;
    const response = await fetch("/api/appointments", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load doctor's appointments.");
    setBookings(result.appointments || []);
    setLive(true);
  }, [accessToken]);

  const realtimeConnected = useRealtimeRefresh(
    realtimeTopic ? [{ name: realtimeTopic, private: true }] : [],
    refreshLive,
    15000,
  );

  useEffect(() => {
    let active = true;
    ensureSupabaseBrowser().then((client) => {
      if (!active) return;
      if (client) {
        setSupabase(client);
        client.auth.getSession().then(({ data, error }) => {
          if (error) setMessage(error.message);
          const user = data.session?.user;
          if (!user || !active) {
            if (active) {
              setBookings(JSON.parse(localStorage.getItem("healthx_appointments") || "[]"));
              setMessage("Sign in with the Auth account linked to a doctor profile to sync cloud appointments.");
            }
            return;
          }
          setAccessToken(data.session.access_token);
          setRealtimeTopic(`doctor-appointments-${user.id}`);
          refreshLive(data.session.access_token).catch((reason) => setMessage(reason.message));
        });
      } else {
        setBookings(JSON.parse(localStorage.getItem("healthx_appointments") || "[]"));
      }
    });
    return () => { active = false; };
  }, [refreshLive]);

  async function updateStatus(appointmentId, status) {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update appointment.");
      setMessage(`Appointment status updated to ${status}.`);
    } catch (error) {
      setMessage(error.message || "Could not update appointment.");
    }
  }

  async function joinAppointment(appointmentId) {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/teleconsult/room-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ appointmentId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not join secure room.");
      setRoomUrl(`https://8x8.vc/${result.appId}/${result.room}?jwt=${encodeURIComponent(result.token)}`);
    } catch (error) {
      setMessage(error.message || "Could not join secure room.");
    }
  }

  async function savePrescription(event) {
    event.preventDefault();
    if (!prescriptionAppointment || !prescriptionText.trim()) return;
    setPrescriptionBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const appointment = prescriptionAppointment;
      const blob = await generatePdf({
        fileName: `${appointment.id}-prescription.pdf`,
        title: "Doctor prescription",
        returnBlob: true,
        watermark: "Private prescription · Swasth Saathi Care Portal",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.setFontSize(11);
          document.text(`Patient: ${appointment.patient_name || "Patient"}`, 16, 44);
          document.text(`Doctor: ${appointment.doctors?.name || "Assigned doctor"}`, 16, 56);
          document.text(`Date: ${new Date().toLocaleDateString()}`, 16, 68);
          document.setFontSize(10);
          document.text("Prescription / instructions:", 16, 86);
          document.text(prescriptionText.trim(), 16, 98, { maxWidth: 175 });
        },
      });
      const form = new FormData();
      form.append("file", blob, `${appointment.id}-prescription.pdf`);
      const response = await fetch(`/api/appointments/${appointment.id}/prescription`, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save prescription.");
      setMessage("Prescription PDF saved to the patient's private reports.");
      setPrescriptionAppointment(null);
      setPrescriptionText("");
    } catch (error) {
      console.error("Could not save appointment prescription", error);
      setMessage(error.message || "Could not save prescription. Please try again.");
    } finally {
      setPrescriptionBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-900">Doctor Appointment Dashboard</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LiveIndicator connected={realtimeConnected} />
        <p className="text-sm">{live ? "Appointments use Realtime updates with polling fallback." : "Local appointments synced in this browser."}</p>
      </div>
      {message && <p role="status" className="mt-3 rounded bg-amber-50 p-3">{message}</p>}
      <div className="mt-6 space-y-3">{bookings.length ? bookings.map((booking) => <article key={booking.id} className="rounded border bg-white p-4">
        <h2 className="font-bold">{booking.patient_name || booking.patient || "Patient account"} · {booking.mode}</h2>
        <p>{booking.doctors?.name || booking.doctor} · {booking.doctors?.speciality || booking.specialization}</p>
        <p>{booking.starts_at ? new Date(booking.starts_at).toLocaleString() : `${booking.date} at ${booking.time}`}</p>
        <p className="text-sm text-green-700">{booking.status}</p>
        {live && booking.status !== "cancelled" && <div className="mt-3 flex gap-2"><button onClick={() => joinAppointment(booking.id)} className="rounded border px-3 py-2">Join secure room</button>{booking.status !== "completed" && <><button onClick={() => updateStatus(booking.id, "confirmed")} className="rounded border px-3 py-2">Confirm</button><button onClick={() => updateStatus(booking.id, "completed")} className="rounded border px-3 py-2">Complete</button></>}{booking.status === "completed" && <button onClick={() => { setPrescriptionAppointment(booking); setPrescriptionText(""); }} className="rounded border border-teal-800 px-3 py-2">Add prescription PDF</button>}</div>}
      </article>) : <p className="rounded border border-dashed p-8 text-center">{live ? "No appointments assigned to this doctor account." : "No scheduled appointments yet."}</p>}</div>
      {roomUrl && <iframe title="Private teleconsultation room" referrerPolicy="no-referrer" allow="camera; microphone; fullscreen; display-capture" className="mt-6 h-96 w-full rounded border" src={roomUrl} />}
      {prescriptionAppointment && <form onSubmit={savePrescription} className="mt-6 rounded-lg border bg-white p-5"><h2 className="text-xl font-bold">Prescription for {prescriptionAppointment.patient_name || "patient"}</h2><label className="mt-3 block">Medication and instructions<textarea required maxLength={2000} rows={6} className="mt-1 w-full rounded border px-3 py-2" value={prescriptionText} onChange={(event) => setPrescriptionText(event.target.value)} /></label><div className="mt-3 flex gap-2"><button disabled={prescriptionBusy} className="rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-60">{prescriptionBusy ? "Saving..." : "Generate and save PDF"}</button><button type="button" onClick={() => setPrescriptionAppointment(null)} className="rounded border px-4 py-2">Cancel</button></div></form>}
    </div>
  );
}
