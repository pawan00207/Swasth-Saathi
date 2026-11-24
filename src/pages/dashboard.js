import React from "react";
import { useRecoilState } from "recoil";
import { didState } from "@/atoms/data";
import Navbar from "@/components/navbar";
import PatientDashboard from "@/components/PatientDashboard";
import UserBanner from "@/components/dashboard/userBanner";
import { UserTable } from "@/components/dashboard/userTable";
import OrganizationBanner from "@/components/dashboard/organizationBanner";
import { OrganizationTable } from "@/components/dashboard/organizationTable";

const MyDashboard = () => {
  const [didData] = useRecoilState(didState);

  const isUser = !didData?.userType || didData.userType.includes("individual");

  return (
    <div className="swasth-canvas min-h-screen text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-8">
        {isUser ? (
          <>
            <UserBanner />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <UserTable />
            </div>
            <PatientDashboard compact />
          </>
        ) : (
          <>
            <OrganizationBanner />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <OrganizationTable />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MyDashboard;
