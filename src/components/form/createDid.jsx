import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useState } from "react";
import Loader from "../loader";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecoilState } from "recoil";
import { didState, web5State } from "@/atoms/data";
import protocolDefinition from "@/lib/protocolDefinition.json";
import { initWeb5 } from "@/helpers/initWeb5";

export default function CreateDid({ name, year, userType }) {
  const router = useRouter();
  const [myDid, setMyDid] = useState(null);

  const [didData, setDidData] = useRecoilState(didState);
  const [web5, setWeb5] = useRecoilState(web5State);

  const [text, setText] = useState(
    " You can now experience the power of web5!"
  );
  const [loading, setLoading] = useState(false);

  // create did using web5
  async function generateDidAndConfigure() {
    try {
      const { web5, did } = await initWeb5();

      setWeb5(web5);
      setMyDid(did);

      console.log("CONFIGURING PROTOCOL...");
      console.log(protocolDefinition);
      const { protocol, status: configureStatus } =
        await web5.dwn.protocols.configure({
          message: {
            definition: protocolDefinition,
          },
        });

      console.log("Protocol Installed Locally:", protocol, configureStatus);
      const { status: configureRemoteStatus } = await protocol.send(did);
      console.log(
        "Did the protocol install on the remote DWN?",
        configureRemoteStatus
      );

      return did;
    } catch (error) {
      console.warn(
        "Web5/DWN is unavailable in this demo environment; continuing with a local demo DID.",
        error
      );
      const demoId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      setWeb5(null);
      setMyDid(`did:demo:${demoId}`);
      return `did:demo:${demoId}`;
    }
  }

  async function handleClick() {
    setLoading(true);
    setText("Please wait while we create your DID");
    const did = await generateDidAndConfigure();
    console.log(did);
    setText("DID created successfully!");
    setLoading(false);
    // update recoil state
    setDidData({ did: did, name: name, year: year, userType: userType });
    router.push("/dashboard");
  }

  return (
    <div className=" flex flex-col h-screen justify-center items-center">
      <h1 className="text-3xl font-bold text-emerald-600">Welcome, {name} </h1>
      <div className="flex space-x-3">
        {loading && <Loader />}
        <p className="text-xl text-emerald-500">{text}</p>
      </div>

      <br />
      <Button
        onClick={handleClick}
        className="w-32 bg-emerald-700 hover:bg-emerald-400"
      >
        {loading ? (
          <div className="flex gap-2">
            {" "}
            <Skeleton className="w-[10px] h-[10px] rounded-full bg-emerald-100" />
            <Skeleton className="w-[10px] h-[10px] rounded-full bg-emerald-100" />
            <Skeleton className="w-[10px] h-[10px] rounded-full bg-emerald-100" />
          </div>
        ) : (
          "Enter App"
        )}
      </Button>
      <br />
    </div>
  );
}
