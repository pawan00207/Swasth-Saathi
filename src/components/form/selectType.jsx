import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function SelectType({ setType, setStep }) {
  const [value, setValue] = React.useState("");
  // console.log(value);

  return (
    <div className="flex flex-col mt-48 justify-center items-center animate-in slide-in-from-bottom fade-in duration-700 ">
      <h1 className="text-5xl mb-8 font-semibold text-emerald-500">
        Are you an individual or Organization?
      </h1>
      <ToggleGroup
        value={value}
        onValueChange={(value) => {
          if (value) {
            setValue(value);
            setType(value);
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
          className="text-lg text-emerald-600 hover:text-white"
        >
          <h2>Individual</h2>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="organization"
          aria-label="Toggle Organization"
          className="text-lg text-emerald-600 hover:text-white"
        >
          <h2>Organization</h2>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
