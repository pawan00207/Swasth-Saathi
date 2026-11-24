import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useState } from "react";
import Loader from "../loader";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecoilState } from "recoil";
import { didState, web5State } from "@/atoms/data";
import protocolDefinition from "@/lib/protocolDefinition.json";
import { initWeb5 } from "@/helpers/initWeb5";

export default function CreateDid({ name, year, userType, embedded = false }) {
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
        "Web5/DWN is unavailable; continuing with a local Swasth DID.",
        error
      );
      const localId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      setWeb5(null);
      setMyDid(`did:swasth:${localId}`);
      return `did:swasth:${localId}`;
    }
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setText("Please wait while we create your DID");
    const did = await generateDidAndConfigure();
    setText("DID created successfully!");
    // update recoil state
    setDidData({ did: did, name: name, year: year, userType: userType });
    try {
      await router.push("/dashboard");
    } catch (error) {
      if (!error?.cancelled) {
        console.error("Failed to navigate to dashboard", error);
        setLoading(false);
      }
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center ${embedded ? "py-6" : "min-h-[60vh]"}`}>
      <h1 className="text-2xl font-bold text-teal-900">Welcome, {name}</h1>
      <div className="mt-2 flex space-x-3">
        {loading && <Loader />}
        <p className="text-base text-slate-700">{text}</p>
      </div>

      <br />
      <Button
        type="button"
        disabled={loading}
        onClick={handleClick}
        className="w-32 bg-emerald-700 hover:bg-emerald-400 disabled:opacity-70"
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
