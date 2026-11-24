import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EnterDetails({ type, details, setDetails, setStep }) {
  const individual = type === "individual";
  const [name, setName] = useState(details.name);
  const [year, setYear] = useState(details.year);

  function handleSubmit(event) {
    event.preventDefault();
    setDetails({ name, year });
    setStep(2);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <h3 className="text-lg font-semibold">{individual ? "Your details" : "Organization details"}</h3>
      <div className="grid gap-2">
        <Label htmlFor="record-name">{individual ? "Full name" : "Organization name"}</Label>
        <Input id="record-name" value={name} onChange={(event) => setName(event.target.value)}
          autoComplete={individual ? "name" : "organization"} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="record-date">{individual ? "Date of birth" : "Date established"}</Label>
        <Input id="record-date" value={year} type="date" onChange={(event) => setYear(event.target.value)}
          autoComplete={individual ? "bday" : undefined} required />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Continue</Button>
        <Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button>
      </div>
    </form>
  );
}
