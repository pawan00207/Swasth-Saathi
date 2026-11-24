import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function SelectType({ setType, setStep, embedded = false }) {
  const [value, setValue] = React.useState("");

  return (
    <div className={`flex flex-col items-center justify-center ${embedded ? "py-6" : "mt-32"} animate-in slide-in-from-bottom fade-in duration-700`}>
      <h2 className={`${embedded ? "text-xl mb-4" : "text-4xl mb-8"} text-center font-bold text-slate-950`}>
        Are you an individual or Organization?
      </h2>
      <ToggleGroup
        value={value}
        onValueChange={(next) => {
          if (next) {
            setValue(next);
            setType(next);
            setStep(1);
          }
        }}
        size={"lg"}
        variant="outline"
        type="single"
      >
        <ToggleGroupItem
          value="individual"
          aria-label="Toggle user"
          className="text-base font-semibold text-teal-900 hover:bg-teal-800 hover:text-white"
        >
          <span>Individual</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="organization"
          aria-label="Toggle Organization"
          className="text-base font-semibold text-teal-900 hover:bg-teal-800 hover:text-white"
        >
          <span>Organization</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
