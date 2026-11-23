"use client";
import { useState } from "react";
import RecordQr from "../../../features/records-qr/RecordQr";

export default function UploadReportPage() {
  const [record, setRecord] = useState({patientId:"", reportType:"Pathology", doctor:"", notes:"", fileName:""});
  const [savedId,setSavedId]=useState("");
  function submit(e) {
    e.preventDefault();
    const id=`${record.patientId}-${Date.now()}`;
    const item={...record,id,uploadedAt:new Date().toISOString(),mock:true};
    const reports=JSON.parse(localStorage.getItem("healthx_demo_reports")||"[]");
    localStorage.setItem("healthx_demo_reports",JSON.stringify([item,...reports]));
    setSavedId(id); console.log("analytics:event","demo_report_upload",id);
  }
  return <div className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-3xl font-bold text-teal-900">Doctor Report Upload</h1><p className="mt-2 text-slate-600">Demo upload: file metadata is stored locally; no medical file is sent to a server.</p><div className="mt-6 grid gap-6 md:grid-cols-2"><form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-5"><label className="block">Patient ID<input required className="mt-1 w-full rounded border px-3 py-2" value={record.patientId} onChange={(e)=>setRecord({...record,patientId:e.target.value})}/></label><label className="block">Report type<select className="mt-1 w-full rounded border px-3 py-2" value={record.reportType} onChange={(e)=>setRecord({...record,reportType:e.target.value})}><option>Pathology</option><option>Radiology</option><option>Cardiology</option><option>Neurology</option></select></label><label className="block">Doctor name<input required className="mt-1 w-full rounded border px-3 py-2" value={record.doctor} onChange={(e)=>setRecord({...record,doctor:e.target.value})}/></label><label className="block">Notes<textarea className="mt-1 w-full rounded border px-3 py-2" value={record.notes} onChange={(e)=>setRecord({...record,notes:e.target.value})}/></label><label className="block">Report file<input required type="file" className="mt-1 w-full" onChange={(e)=>setRecord({...record,fileName:e.target.files?.[0]?.name||""})}/></label><button className="rounded bg-teal-800 px-4 py-2 font-semibold text-white">Create demo report</button></form>{savedId?<div><RecordQr recordId={savedId}/><p className="mt-3 text-sm">Report ID: {savedId}</p></div>:<div className="rounded border border-dashed p-8 text-center text-slate-600">Submit the form to generate a record QR.</div>}</div></div>;
}
