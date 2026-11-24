import Head from "next/head";
import Link from "next/link";
import { Copy, FileHeart } from "lucide-react";
import { useState } from "react";
import { useRecoilValue } from "recoil";
import { didState } from "@/atoms/data";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/dashboard/userTable";
import { OrganizationTable } from "@/components/dashboard/organizationTable";

export default function RecordDashboard() {
  const profile = useRecoilValue(didState);
  const [copyMessage, setCopyMessage] = useState("");
  const individual = profile?.userType === "individual";
  const identity = profile?.did;
  const stats = individual
    ? [["Health records", profile.userTotalrecords], ["Hospitals", profile.totalIssuersForUser]]
    : [["Records issued", profile?.organizationTotalRecords], ["Patients registered", profile?.totalPatientsForHospital]];

  async function copyIdentity() {
    try {
      await navigator.clipboard.writeText(identity);
      setCopyMessage("Record ID copied");
    } catch {
      setCopyMessage("Could not copy the record ID");
    }
  }

  return (
    <div className="site-container py-8 sm:py-12">
      <Head><title>Record dashboard | Swasth Saathi</title></Head>
      <header className="mb-6">
        <h1>Record dashboard</h1>
        <p className="mt-2 text-slate-700">Manage health records linked to your record identity.</p>
      </header>
      {identity ? (
        <>
          <section className="grid gap-4 md:grid-cols-[1.35fr_1fr]" aria-label="Record workspace overview">
            <div className="site-panel">
              <h2 className="text-lg font-semibold">{profile.name || "Record identity"}</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-600">Role</dt>
                  <dd className="mt-1 capitalize">{profile.userType}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">{individual ? "Date of birth" : "Date established"}</dt>
                  <dd className="mt-1">{profile.year || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-600">Record ID</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all">{identity.slice(0, 16)}…{identity.slice(-8)}</code>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyIdentity}>
                      <Copy size={16} strokeWidth={1.5} aria-hidden="true" /> Copy ID
                    </Button>
                  </dd>
                </div>
              </dl>
              {copyMessage && <p className="mt-2 text-sm text-slate-700" role="status">{copyMessage}</p>}
            </div>
            <dl className="site-panel grid content-center grid-cols-2 gap-4">
              {stats.map(([label, count]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="mt-2 text-3xl font-medium tabular-nums">{count ?? 0}</dd>
                </div>
              ))}
            </dl>
          </section>
          {individual ? <UserTable /> : <OrganizationTable />}
        </>
      ) : (
        <section className="site-panel max-w-2xl" aria-labelledby="record-empty-title">
          <FileHeart className="mb-4 text-teal-800" size={24} strokeWidth={1.5} aria-hidden="true" />
          <h2 className="text-xl font-semibold" id="record-empty-title">Set up a record identity</h2>
          <p className="mt-2 text-slate-700">Choose an individual or organization workspace to view or issue records here.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><Link href="/#record-setup">Set up records</Link></Button>
            <Button asChild variant="outline"><Link href="/records">Go to My Reports</Link></Button>
          </div>
        </section>
      )}
    </div>
  );
}
