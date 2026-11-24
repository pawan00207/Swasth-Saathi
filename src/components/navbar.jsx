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
  const formattedDid = didValue ? `${didValue.slice(8, 16)}...${didValue.slice(-8)}` : "ABHA / DID";

  function handleCopyToClipboard() {
    if (didValue) navigator.clipboard.writeText(didValue);
  }
  const bgColor =
    didData?.userType === "organization" ? "bg-slate-900" : "bg-teal-950";
  const textColor = "text-slate-100";
  const badgeColor = "bg-teal-50 text-teal-950";
  return (
    <div className={`border-b border-slate-800 px-4 py-2.5 ${bgColor} flex justify-between items-center`}>
      <Link href="/" className="flex gap-2 items-center">
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src="favicon.svg" alt="Swasth Saathi" />
          <AvatarFallback>SS</AvatarFallback>
        </Avatar>
        <p className={`font-bold ${textColor} text-lg`}>Swasth Saathi</p>
      </Link>

      <div className="flex items-center">
        <nav aria-label="Swasth Saathi modules" className="mr-4 hidden items-center gap-3 text-xs font-semibold md:flex">
          <Link href="/patient" className={`${textColor} hover:underline`}>Patient Hub</Link>
          <Link href="/schemes" className={`${textColor} hover:underline`}>Schemes</Link>
          <Link href="/beds" className={`${textColor} hover:underline`}>Beds</Link>
          <Link href="/billing" className={`${textColor} hover:underline`}>Care Wallet</Link>
          <Link href="/abdm" className={`${textColor} hover:underline`}>ABDM</Link>
          <Link href="/route" className={`${textColor} hover:underline`}>Route</Link>
          <Link href="/consult" className={`${textColor} hover:underline`}>Consult</Link>
        </nav>
        <Badge className={`h-8 ${badgeColor} text-md`}>{formattedDid}</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Copy DID"
                onClick={handleCopyToClipboard}
                className={`cursor-pointer ml-2 mr-4 inline-flex h-8 items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold text-slate-900 ${badgeColor}`}
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
  );
};

export default Navbar;
