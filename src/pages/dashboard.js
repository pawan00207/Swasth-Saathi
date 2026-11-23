import React from "react";
import { useRecoilState } from "recoil";
import { didState } from "@/atoms/data";
import Navbar from "@/components/navbar";
import UserBanner from "@/components/dashboard/userBanner";
import { UserTable } from "@/components/dashboard/userTable";
import OrganizationBanner from "@/components/dashboard/organizationBanner";
import { OrganizationTable } from "@/components/dashboard/organizationTable";

const MyDashboard = () => {
  const [didData, setDidData] = useRecoilState(didState);

  const isUser = didData.userType.includes("individual");

  return (
    <>
      <Navbar />
      {isUser ? (
        <div className="bg-emerald-100 h-screen">
          <UserBanner />
          <UserTable />
        </div>
      ) : (
        <div className="bg-cyan-100 h-screen">
          <OrganizationBanner />
          <OrganizationTable />
        </div>
      )}
    </>
  );
};

export default MyDashboard;
