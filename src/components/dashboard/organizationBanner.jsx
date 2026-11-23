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
  const [didData, setDidData] = useRecoilState(didState);
  const formattedDid = `${didData.did.slice(8, 16)}...${didData.did.slice(-8)}`;

  useEffect(() => {
    console.log(didData);
  }, [didData]);

  function handleCopyToClipboard() {
    navigator.clipboard.writeText(didData.did);
  }
  return (
    <div className="grid grid-cols-2 gap-8 p-8">
      <Card className=" text-cyan-900 bg-cyan-50">
        <CardHeader className="grid grid-cols-2 justify-between gap-2 ">
          <div>
            <div className="">
              <CardTitle className="text-cyan-900">DID </CardTitle>
              <div className="flex mt-2">
                <CardDescription>{formattedDid}</CardDescription>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div
                        className="cursor-pointer ml-2 mr-4 h-8 text-md"
                        onClick={handleCopyToClipboard}
                      >
                        <CopyIcon />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy DID</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="mt-2">
              <CardTitle className="text-cyan-900">
                Organization Name{" "}
              </CardTitle>
              <CardDescription className="mt-2">{didData.name}</CardDescription>
            </div>
          </div>
          <div>
            <div>
              <CardTitle className="text-cyan-900">
                Year of Establishment{" "}
              </CardTitle>
              <CardDescription className="mt-2">{didData.year}</CardDescription>
            </div>
            <div className="mt-3">
              <CardTitle className="text-cyan-900">User Type </CardTitle>
              <CardDescription>
                <Badge className="mt-2 text-lg bg-cyan-200 hover:bg-cyan-200">
                  {didData.userType}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card className=" text-cyan-900 bg-cyan-50">
        <div className="grid grid-cols-2 justify-center h-full">
          <div className="flex flex-col items-center justify-center">
            <dt class="mb-2 text-3xl font-extrabold">
              {didData.organizationTotalRecords}
            </dt>
            <dd class="text-gray-500 dark:text-gray-400">
              Health Records Issued
            </dd>
          </div>
          <div class="flex flex-col items-center justify-center">
            <dt class="mb-2 text-3xl font-extrabold">
              {didData.totalPatientsForHospital}
            </dt>
            <dd class="text-gray-500 dark:text-gray-400">
              Patients Registered
            </dd>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OrganizationBanner;
