"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:border-slate-800 dark:focus:ring-slate-300",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-300 text-slate-900 hover:bg-slate-200 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/80",
        user: "border-transparent bg-emerald-700 text-emerald-50 hover:bg-emerald-400 dark:bg-emerald-50 dark:text-emerald-50 dark:hover:bg-emerald-800/80",
        organization:
          "border-transparent bg-cyan-500 text-cyan-50 hover:bg-cyan-500/80 dark:bg-cyan-900 dark:text-cyan-50 dark:hover:bg-cyan-900/80",
        outline: "text-slate-950 dark:text-slate-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
