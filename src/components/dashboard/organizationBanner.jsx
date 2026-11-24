"use client";
import React, { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRecoilState } from "recoil";
import { didState } from "@/atoms/data";
import { CopyIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OrganizationBanner = () => {
  const [didData] = useRecoilState(didState);
  const rawDid = didData?.did || "";
  const formattedDid = rawDid ? `${rawDid.slice(8, 16)}...${rawDid.slice(-8)}` : "did:swasth:org";

  function handleCopyToClipboard() {
    if (rawDid) navigator.clipboard.writeText(rawDid);
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-slate-200 bg-white text-slate-900">
        <CardHeader className="grid grid-cols-2 justify-between gap-2">
          <div>
            <div>
              <CardTitle className="text-slate-950">DID</CardTitle>
              <div className="mt-2 flex items-center">
                <CardDescription className="font-mono text-slate-700">{formattedDid}</CardDescription>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Copy DID"
                        className="ml-2 mr-4 inline-flex h-8 cursor-pointer items-center text-slate-700 hover:text-teal-800"
                        onClick={handleCopyToClipboard}
                      >
                        <CopyIcon />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy DID</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="mt-2">
              <CardTitle className="text-slate-950">Organization Name</CardTitle>
              <CardDescription className="mt-1 text-slate-700">{didData?.name || "Partner Hospital"}</CardDescription>
            </div>
          </div>
          <div>
            <div>
              <CardTitle className="text-slate-950">Year of Establishment</CardTitle>
              <CardDescription className="mt-1 tabular-nums text-slate-700">{didData?.year || "Not set"}</CardDescription>
            </div>
            <div className="mt-3">
              <CardTitle className="text-slate-950">User Type</CardTitle>
              <div className="text-sm text-slate-600">
                <Badge className="mt-1.5 bg-teal-50 text-teal-900 hover:bg-teal-100">
                  {didData?.userType || "organization"}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className="border-slate-200 bg-white text-slate-900">
        <dl className="grid h-full grid-cols-2 items-center justify-center py-4">
          <div className="flex flex-col items-center justify-center">
            <dt className="tabular-nums mb-1 text-3xl font-extrabold text-slate-950">
              {didData?.organizationTotalRecords ?? 0}
            </dt>
            <dd className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Health Records Issued
            </dd>
          </div>
          <div className="flex flex-col items-center justify-center">
            <dt className="tabular-nums mb-1 text-3xl font-extrabold text-slate-950">
              {didData?.totalPatientsForHospital ?? 0}
            </dt>
            <dd className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patients Registered
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
};

export default OrganizationBanner;
