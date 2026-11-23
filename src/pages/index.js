import React from "react";
import { useState, useEffect } from "react";
import SelectType from "@/components/form/selectType";
import EnterDetails from "@/components/form/EnterDetails";
import CreateDid from "@/components/form/createDid";

export default function Form() {
  const [type, setType] = useState(""); // "individual" or "organization"
  const [details, setDetails] = useState({ name: "", year: "" }); // user or organization details
  const [step, setStep] = useState(0); // step state

  return (
    <div>
      {step === 0 && <SelectType setType={setType} setStep={setStep} />}
      {step === 1 && (
        <EnterDetails type={type} setDetails={setDetails} setStep={setStep} />
      )}
      {step === 2 && (
        <CreateDid name={details.name} year={details.year} userType={type} />
      )}
    </div>
  );
}
