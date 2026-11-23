import RecordQr from "../../../../features/records-qr/RecordQr";

export function generateMetadata({ params }) { return { title: `Medical Report ${params.id} | Swasth Saathi`, description: "View a Swasth Saathi demo medical report." }; }

export default function PatientRecordPage({ params }) {
  return <div className="mx-auto max-w-4xl px-4 py-8"><div className="border-4 border-amber-400 bg-amber-50 p-3 text-center font-bold text-amber-950">DEMO REPORT - NOT FOR CLINICAL DECISION-MAKING</div><h1 className="mt-6 text-3xl font-bold">Medical Report</h1><div className="mt-4 grid gap-6 md:grid-cols-2"><section className="rounded-lg border bg-white p-5"><p><strong>Record ID:</strong> {params.id}</p><p className="mt-2"><strong>Patient:</strong> Demo Patient</p><p className="mt-2"><strong>Status:</strong> Seeded for hackathon demonstration</p><p className="mt-2"><strong>Source:</strong> Doctor upload demo metadata</p></section><RecordQr recordId={params.id}/></div></div>;
}
