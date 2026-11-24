import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EnterDetails = ({ type, setDetails, setStep }) => {
  let cardTitle = "";
  let dobLabel = "";
  let userType = type;

  const [formData, setFormData] = React.useState({ name: "", year: "" });

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  if (type === "individual") {
    userType = "individual";
    cardTitle = "User Details";
    dobLabel = "D.O.B.";
  } else {
    userType = "organization";
    cardTitle = "Organization Details";
    dobLabel = "Year of Establishment";
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    // set details
    setDetails(formData);

    // change step
    setStep(2);
  };
  return (
    <div className="flex flex-col mt-40 justify-center items-center animate-in slide-in-from-bottom fade-in duration-700">
      <Card className="w-[550px]">
        <CardHeader>
          <CardTitle className="text-emerald-600">{cardTitle}</CardTitle>
          <CardDescription className="text-emerald-400">
            Enter your details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-emerald-600">Name</Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={`Enter ${
                    userType === "individual" ? "your" : "organization's"
                  } name`}
                  required
                  className="border border-emerald-300"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label className="text-emerald-600">{dobLabel}</Label>
                <Input
                  name="year"
                  value={formData.year}
                  type="date"
                  onChange={handleChange}
                  placeholder={`Enter ${
                    userType === "individual"
                      ? "your D.O.B"
                      : "your year of establishment"
                  } `}
                  required
                  className="border border-emerald-300"
                />
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <Button className="bg-emerald-600 hover:bg-emerald-400">
                Next
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnterDetails;
