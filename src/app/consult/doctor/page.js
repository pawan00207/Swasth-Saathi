"use client";
import { useEffect,useState } from "react";
export default function DoctorDashboard(){
 const [bookings,setBookings]=useState([]);
 useEffect(()=>setBookings(JSON.parse(localStorage.getItem("healthx_appointments")||"[]")),[]);
 return <div className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-3xl font-bold text-teal-900">Doctor Appointment Dashboard</h1><p className="mt-2 text-sm">Demo appointments stored in this browser.</p><div className="mt-6 space-y-3">{bookings.length?bookings.map((b)=><article key={b.id} className="rounded border bg-white p-4"><h2 className="font-bold">{b.patient} - {b.mode}</h2><p>{b.doctor} | {b.specialization}</p><p>{b.date} at {b.time}</p><p className="text-sm text-green-700">{b.status}</p></article>):<p className="rounded border border-dashed p-8 text-center">No demo appointments yet.</p>}</div></div>;
}
