import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlusCircledIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { didState } from "@/atoms/data";
import { useRecoilValue } from "recoil";
import { initWeb5 } from "@/helpers/initWeb5";
import Loader from "../loader";

export function IssueHealthRecord() {
  const didData = useRecoilValue(didState);

  const [isLoading, setIsLoading] = useState(false);
  const [sendRecordSuccess, setSendRecordSuccess] = useState(false);
  const [healthRecordData, setHealthRecordData] = useState({
    patientName: "",
    patientDid: "",
    healthRecordName: "",
    category: "",
    file: "",
  });

  function handleClick() {
    // reset all state values
    setHealthRecordData({
      patientName: "",
      patientDid: "",
      healthRecordName: "",
      category: "",
      file: "",
    });
    setSendRecordSuccess(false);
    setIsLoading(false);
  }

  // create base64 image
  const createBase64Image = async (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
    });
  };

  // construct health Record
  const constructhealthRecord = async (
    senderDid,
    patientName,
    healthRecordName,
    healthRecordCategory,
    imageFile,
    receiverDid
  ) => {
    let image = null;

    // image = await createBase64Image(imageFile);

    // upload image to cloudinary
    const data = new FormData();
    data.append("file", imageFile);
    data.append("upload_preset", "healthX_preset");
    data.append("cloud_name", "healthx");
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/healthx/image/upload",
      {
        method: "POST",
        body: data,
      }
    );
    const file = await res.json();
    image = file.secure_url;
    //////////////////////

    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    const healthRecord = {
      sender: senderDid,
      patientName: patientName,
      healthRecordName: healthRecordName,
      healthRecordCategory: healthRecordCategory,
      image: image,
      recipient: receiverDid,
      issuedOn: `${currentDate} ${currentTime}`,
    };
    return healthRecord;
  };

  // send health record
  async function sendhealthRecord(receiverDid) {
    try {
      setIsLoading(true);
      // construct health record here - will need to pass all arguments from form
      const healthRecord = await constructhealthRecord(
        didData.did,
        healthRecordData.patientName,
        healthRecordData.healthRecordName,
        healthRecordData.category,
        healthRecordData.file,
        healthRecordData.patientDid,
        healthRecordData.patientName
      );
      console.log("healthRecord Data: ", healthRecord);

      const { web5 } = await initWeb5();

      const { record } = await web5.dwn.records.write({
        data: healthRecord,
        message: {
          protocol: "http://www.alphadevs.dev/healthxprotocol",
          protocolPath: "healthrecord",
          schema: "http://www.alphadevs.dev/healthxprotocol/healthrecord",
          recipient: healthRecordData.patientDid,
          dataFormat: "application/json",
        },
      });
      console.log("Record created:", record);

      // send to remote dwn instantly
      const { status } = await record.send(receiverDid);
      console.log("Record sent status : ", status);
      setIsLoading(false);
      setSendRecordSuccess(true);
    } catch (error) {
      console.error("Error submitting health record:", error);
      setIsLoading(false);
    }
  }

  function handlehealthRecordIssue(event) {
    event.preventDefault();
    console.log("Creating record...");
    sendhealthRecord(healthRecordData.patientDid);
  }

  return (
    <Dialog>
      <DialogTrigger>
        <Button
          onClick={handleClick}
          className="bg-cyan-900 text-cyan-50 hover:bg-cyan-500"
        >
          <PlusCircledIcon className="mt-0.5" />
          <span className="w-2"> </span>Issue Record
        </Button>
      </DialogTrigger>
      <DialogContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-4">
            <Loader />
            <p>Creating Record ...</p>
          </div>
        ) : (
          <>
            {!sendRecordSuccess ? (
              <DialogHeader>
                <DialogTitle className="text-cyan-900">
                  Issue a Health Record.
                </DialogTitle>
                <DialogDescription>
                  <Card className="p-2 border-cyan-800 bg-cyan-50 ">
                    <CardHeader>
                      {/* <CardTitle className="text-cyan-600">
                        Create project
                      </CardTitle> */}
                      <CardDescription className="text-cyan-600">
                        Enter details to issue a healthRecord.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handlehealthRecordIssue}>
                        <div className="grid w-full items-center gap-4">
                          <div className="flex flex-col space-y-1.5">
                            <Label className="text-cyan-600">
                              Patient's Name
                            </Label>
                            <Input
                              value={healthRecordData.patientName}
                              onChange={(event) =>
                                setHealthRecordData({
                                  ...healthRecordData,
                                  patientName: event.target.value,
                                })
                              }
                              placeholder="Enter the Patient Name"
                              className="border border-cyan-300"
                              required
                            />
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label className="text-cyan-600">
                              Patient's DID
                            </Label>
                            <Input
                              value={healthRecordData.patientDid}
                              onChange={(event) =>
                                setHealthRecordData({
                                  ...healthRecordData,
                                  patientDid: event.target.value,
                                })
                              }
                              placeholder="Enter the Patient's DID"
                              className="border border-cyan-300"
                              required
                            />
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label className="text-cyan-600">
                              Health Record Name
                            </Label>
                            <Input
                              value={healthRecordData.healthRecordName}
                              onChange={(event) =>
                                setHealthRecordData({
                                  ...healthRecordData,
                                  healthRecordName: event.target.value,
                                })
                              }
                              placeholder="Enter the Health Record name"
                              className="border border-cyan-300"
                              required
                            />
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label className="text-cyan-600">
                              Health Record Category
                            </Label>
                            <Select
                              placeholder="Select a category"
                              onValueChange={(value) =>
                                setHealthRecordData({
                                  ...healthRecordData,
                                  category: value,
                                })
                              }
                              className="border border-cyan-300"
                              required
                            >
                              <SelectTrigger className="">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="Cardiology">
                                    Cardiology
                                  </SelectItem>
                                  <SelectItem value="Pathology">
                                    Pathology
                                  </SelectItem>
                                  <SelectItem value="Neurology">
                                    Neurology
                                  </SelectItem>
                                  <SelectItem value="Radiology">
                                    Radiology
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-1.5">
                            <Label className="text-cyan-600">
                              Upload Record
                            </Label>
                            <Input
                              type="file"
                              onChange={(event) =>
                                setHealthRecordData({
                                  ...healthRecordData,
                                  file: event.target.files[0],
                                })
                              }
                              accept="image/png"
                              placeholder="Choose file"
                              className="border border-cyan-300"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <Button className="bg-cyan-600 hover:bg-cyan-400 mt-2 ">
                            Issue
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </DialogDescription>
              </DialogHeader>
            ) : (
              <div className="flex flex-col gap-4 items-center">
                <CheckCircledIcon className="w-20 h-20 text-green-500" />
                <p>Record Sent Successfully</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
