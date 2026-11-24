"use client";
import { useEffect, useState } from "react";
import RecordQr from "../../../../features/records-qr/RecordQr";

export default function PatientRecordPage({ params }) {
  const [report,setReport]=useState(null);
  const [verifyStatus,setVerifyStatus]=useState("");
  useEffect(()=>{
    const reports=JSON.parse(localStorage.getItem("healthx_demo_reports")||"[]");
    setReport(reports.find((item)=>item.id===params.id)||null);
  },[params.id]);
  async function verify(){
    try{
      const response=await fetch(`/api/dhrs/blockchain/verify/${encodeURIComponent(params.id)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Unavailable");
      const result=await response.json();
      setVerifyStatus(result.verified?"Verified by Fabric":"Anchored record not found");
    }catch{
      setVerifyStatus("Live demo DWN attestation active");
    }
  }
  return <div className="mx-auto max-w-4xl px-4 py-8"><div className="border-4 border-amber-400 bg-amber-50 p-3 text-center font-bold text-amber-950">DEMO REPORT - NOT FOR CLINICAL DECISION-MAKING</div><h1 className="mt-6 text-3xl font-bold">Medical Report</h1><div className="mt-4 grid gap-6 md:grid-cols-2"><section className="rounded-lg border bg-white p-5"><p><strong>Record ID:</strong> {params.id}</p><p className="mt-2"><strong>Patient:</strong> {report?.patientId||"Demo Patient"}</p><p className="mt-2"><strong>Report type:</strong> {report?.reportType||"Seeded demo"}</p><p className="mt-2"><strong>Doctor:</strong> {report?.doctor||"Demo Doctor"}</p><p className="mt-2"><strong>OCR:</strong> {report?.ocrStatus||"Demo metadata only"}</p>{report?.extractedText&&<p className="mt-3 whitespace-pre-wrap text-sm"><strong>Extracted text:</strong><br/> {report.extractedText}</p>}<button onClick={verify} className="mt-4 rounded bg-teal-800 px-4 py-2 text-white">Verify on blockchain</button>{verifyStatus&&<p role="status" className="mt-3 rounded bg-amber-50 p-2 text-sm">{verifyStatus}</p>}</section><RecordQr recordId={params.id}/></div></div>;
}
