import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRecoilState } from "recoil";
import { didState } from "@/atoms/data";
import { CopyIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

const Navbar = () => {
  const [didData, setDidData] = useRecoilState(didState);
  const didValue = didData?.did || "";
  const formattedDid = didValue ? `${didValue.slice(8, 16)}...${didValue.slice(-8)}` : "Demo DID";

  function handleCopyToClipboard() {
    if (didValue) navigator.clipboard.writeText(didValue);
  }
  const bgColor =
    didData.userType === "organization" ? "bg-cyan-600" : "bg-emerald-800";
  const textColor =
    didData.userType === "organization" ? "text-cyan-100" : "text-emerald-100";
  const badgeColor =
    didData.userType === "organization" ? "bg-cyan-100" : "bg-emerald-100";
  return (
    <div className={`p-2 ${bgColor} flex justify-between`}>
      <div className="flex gap-2 items-center">
        <Avatar className="rounded-none">
          <AvatarImage src="favicon.svg" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <p className={`font-bold ${textColor} text-xl`}>Swasth Saathi</p>
      </div>

      <div className="flex items-center">
        <nav aria-label="Swasth Saathi modules" className="mr-3 hidden items-center gap-2 text-sm md:flex">
          <Link href="/schemes" className={`${textColor} hover:underline`}>Schemes</Link>
          <Link href="/route" className={`${textColor} hover:underline`}>Route</Link>
          <Link href="/beds" className={`${textColor} hover:underline`}>Beds</Link>
          <Link href="/consult" className={`${textColor} hover:underline`}>Consult</Link>
        </nav>
        <Badge className={`h-8 ${badgeColor} text-md`}>{formattedDid}</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge
                className={`cursor-pointer ml-2 mr-4 h-8 text-md ${badgeColor}`}
                onClick={handleCopyToClipboard}
              >
                <CopyIcon />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy DID</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default Navbar;
